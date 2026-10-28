using System.Net;
using System.Text;
using Bpm.Uploader.Core.Net;
using Bpm.Uploader.Core.Service;
using Bpm.Uploader.Core.Storage;

namespace Bpm.Uploader.Tests;

/// <summary>Records requests and answers from a script, so the engine can be tested without a server.</summary>
internal sealed class FakeServer : HttpMessageHandler
{
    public readonly List<(string Auth, string Sha, string FileName)> Uploads = [];
    /// <summary>The start of each request body exactly as it goes on the wire.</summary>
    public readonly List<string> Wire = [];
    /// <summary>The `visibility` field of each upload (null when the field was not sent).</summary>
    public readonly List<string?> Visibilities = [];
    public Func<int, (HttpStatusCode Status, string Body)> Reply { get; set; } = _ => (HttpStatusCode.Created, """{"id":7,"status":"QUEUED"}""");

    /// <summary>What the site holds for the account's consent; changed by PUT api/me/consent like the real one.</summary>
    public (bool C1, bool C2, bool C3) Consent { get; set; } = (true, false, false);
    public HttpStatusCode ConsentStatus { get; set; } = HttpStatusCode.OK;
    public int ConsentReads;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (request.RequestUri!.AbsolutePath.EndsWith("/api/me/consent", StringComparison.Ordinal))
        {
            if (request.Method == HttpMethod.Put)
            {
                using var doc = System.Text.Json.JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
                var r = doc.RootElement;
                Consent = (r.GetProperty("c1").GetBoolean(), r.GetProperty("c2").GetBoolean(), r.GetProperty("c3").GetBoolean());
            }
            else ConsentReads++;
            var json = ConsentStatus == HttpStatusCode.OK ? $$"""{"c1":{{Consent.C1.ToString().ToLowerInvariant()}},"c2":{{Consent.C2.ToString().ToLowerInvariant()}},"c3":{{Consent.C3.ToString().ToLowerInvariant()}}}""" : """{"error":"x"}""";
            return new HttpResponseMessage(ConsentStatus) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        }
        var wire = await request.Content!.ReadAsStringAsync(ct);
        Wire.Add(wire.Length > 700 ? wire[..700] : wire);
        var form = (MultipartFormDataContent)request.Content!;
        var sha = "";
        var name = "";
        string? visibility = null;
        foreach (var part in form)
        {
            var field = part.Headers.ContentDisposition!.Name!.Trim('"');
            if (field == "sha256") sha = await part.ReadAsStringAsync(ct);
            if (field == "visibility") visibility = await part.ReadAsStringAsync(ct);
            if (field == "replay") name = part.Headers.ContentDisposition.FileName!.Trim('"');
        }
        Visibilities.Add(visibility);
        Uploads.Add((request.Headers.Authorization?.ToString() ?? "", sha, name));
        var (status, body) = Reply(Uploads.Count);
        return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    }
}

public sealed class UploadServiceTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "bpm-uploader-test-" + Guid.NewGuid().ToString("N"));
    private readonly FakeServer _server = new();
    private readonly UploaderHome _home;
    private readonly string _replays;

    public UploadServiceTests()
    {
        _home = new UploaderHome(Path.Combine(_root, "home"));
        _replays = Path.Combine(_root, "replays");
        Directory.CreateDirectory(_replays);
        new TokenStore(_home).Save("device-token-123");
    }

    public void Dispose()
    {
        try { Directory.Delete(_root, recursive: true); } catch (IOException) { }
    }

    private UploadService NewService(Func<TimeSpan, CancellationToken, Task>? delay = null) =>
        new(_home, token => new ApiClient("http://fake.invalid", token, _server), delay ?? ((_, _) => Task.CompletedTask));

    private string WriteReplay(string name, byte[] bytes)
    {
        var p = Path.Combine(_replays, name);
        File.WriteAllBytes(p, bytes);
        return p;
    }

    private static byte[] BpmReplay(string tag = "") => TestMpq.Replay($"BPM_Ban_Thor\0BPM_Pick_Goliath{tag}");
    private static byte[] LadderReplay() => TestMpq.Replay("SprayTerran\0Stimpack");

    [Fact]
    public async Task Bpm_game_is_uploaded_with_token_and_hash_exactly_once()
    {
        using var svc = NewService();
        var path = WriteReplay("a.SC2Replay", BpmReplay());
        await svc.ProcessAsync(path, CancellationToken.None);
        await svc.ProcessAsync(path, CancellationToken.None);          // restart / rescan must not send it again

        var up = Assert.Single(_server.Uploads);
        Assert.Equal("Bearer device-token-123", up.Auth);
        Assert.Equal(Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(path))), up.Sha);
        Assert.Equal(0, svc.PendingCount);
    }

    [Fact]
    public async Task Private_mode_marks_new_uploads_private_and_default_does_not()
    {
        using var svc = NewService();
        await svc.ProcessAsync(WriteReplay("a.SC2Replay", BpmReplay("a")), CancellationToken.None);
        svc.SetUploadPrivately(true);
        await svc.ProcessAsync(WriteReplay("b.SC2Replay", BpmReplay("b")), CancellationToken.None);
        svc.SetUploadPrivately(false);
        await svc.ProcessAsync(WriteReplay("c.SC2Replay", BpmReplay("c")), CancellationToken.None);

        Assert.Equal([null, "private", null], _server.Visibilities);
        Assert.False(Settings.Load(_home).UploadPrivately);
    }

    [Fact]
    public void Private_mode_survives_a_restart()
    {
        using (var svc = NewService()) svc.SetUploadPrivately(true);
        Assert.True(Settings.Load(_home).UploadPrivately);
    }

    [Fact]
    public async Task Multipart_body_uses_quoted_names_that_the_sites_strict_parser_requires()
    {
        // Regression: .NET's default (name=replay, unquoted) made the site reject every upload with "multipart/form-data expected".
        using var svc = NewService();
        var path = WriteReplay("My Game (1).SC2Replay", BpmReplay());
        await svc.ProcessAsync(path, CancellationToken.None);

        var wire = Assert.Single(_server.Wire);
        Assert.Contains("name=\"replay\"", wire);
        Assert.Contains("name=\"sha256\"", wire);
        Assert.DoesNotContain("name=replay", wire);
        Assert.Contains("filename=\"replay.SC2Replay\"", wire);
        Assert.DoesNotContain("My Game", wire);                     // the local file name stays on this PC
    }

    [Fact]
    public async Task Withdrawn_consent_on_the_website_keeps_the_file_on_the_pc()
    {
        _server.Consent = (false, false, false);
        using var svc = NewService();
        var path = WriteReplay("a.SC2Replay", BpmReplay());
        await svc.ProcessAsync(path, CancellationToken.None);

        Assert.Empty(_server.Uploads);                                   // not even the bytes were sent
        Assert.Empty(_server.Wire);
        Assert.Equal(1, svc.PendingCount);
        Assert.Equal(ServiceState.NeedsConsent, svc.State);
    }

    [Fact]
    public async Task Turning_consent_back_on_from_the_launcher_sends_what_was_waiting()
    {
        _server.Consent = (false, false, false);
        using var svc = NewService();
        var path = WriteReplay("a.SC2Replay", BpmReplay());
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Empty(_server.Uploads);

        var r = await svc.SetConsentAsync(true, false, false);
        Assert.Equal(ConsentKind.Ok, r!.Kind);
        Assert.Equal((true, false, false), _server.Consent);
        Assert.NotEqual(ServiceState.NeedsConsent, svc.State);
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Single(_server.Uploads);
    }

    [Fact]
    public async Task Withdrawing_from_the_launcher_is_reflected_at_once()
    {
        using var svc = NewService();
        svc.Start();
        await svc.SetConsentAsync(false, false, false);
        Assert.Equal(ServiceState.NeedsConsent, svc.State);
        Assert.Equal((false, false, false), _server.Consent);
    }

    [Fact]
    public async Task Consent_lookup_with_a_revoked_token_asks_to_link_again()
    {
        _server.ConsentStatus = HttpStatusCode.Unauthorized;
        using var svc = NewService();
        var r = await svc.GetConsentAsync();
        Assert.Equal(ConsentKind.AuthLost, r!.Kind);
        Assert.Equal(ServiceState.NeedsRelink, svc.State);
        Assert.False(svc.IsLinked);
    }

    [Fact]
    public async Task When_the_consent_lookup_is_unavailable_the_server_still_decides()
    {
        _server.ConsentStatus = HttpStatusCode.BadGateway;
        using var svc = NewService();
        await svc.ProcessAsync(WriteReplay("a.SC2Replay", BpmReplay()), CancellationToken.None);
        Assert.Single(_server.Uploads);                                  // sent; the real server checks C1 before reading the body
    }

    [Fact]
    public void A_folder_with_replays_can_be_added_and_is_remembered()
    {
        WriteReplay("a.SC2Replay", BpmReplay());
        using (var svc = NewService())
        {
            Assert.Equal(AddFolderResult.Added, svc.AddFolder(_replays));
            Assert.Equal(AddFolderResult.AlreadyWatched, svc.AddFolder(_replays));
            Assert.Contains(_replays, svc.ExtraFolders, StringComparer.OrdinalIgnoreCase);
        }
        using var again = NewService();                                  // a restart reads it back from settings.json
        Assert.Contains(_replays, again.ExtraFolders, StringComparer.OrdinalIgnoreCase);
        again.RemoveFolder(_replays);
        Assert.DoesNotContain(_replays, again.ExtraFolders, StringComparer.OrdinalIgnoreCase);
        using var third = NewService();
        Assert.Empty(third.ExtraFolders);
    }

    [Fact]
    public void A_parent_folder_resolves_to_the_replay_folders_below_it()
    {
        var mp1 = Path.Combine(_root, "Documents", "StarCraft II", "Accounts", "1", "1-S2-1-1", "Replays", "Multiplayer");
        var mp2 = Path.Combine(_root, "Documents", "StarCraft II", "Accounts", "1", "2-S2-1-2", "Replays", "Multiplayer");
        Directory.CreateDirectory(mp1);
        Directory.CreateDirectory(mp2);
        Directory.CreateDirectory(Path.Combine(_root, "Documents", "StarCraft II", "Accounts", "1", "3-S2-1-3", "Replays", "Other"));

        using var svc = NewService();
        Assert.Equal(AddFolderResult.Added, svc.AddFolder(Path.Combine(_root, "Documents", "StarCraft II")));
        Assert.Equal(2, svc.ExtraFolders.Count);
        Assert.Contains(mp1, svc.ExtraFolders, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void A_folder_without_replays_is_refused()
    {
        var empty = Path.Combine(_root, "nothing-here");
        Directory.CreateDirectory(empty);
        using var svc = NewService();
        Assert.Equal(AddFolderResult.NoReplaysFound, svc.AddFolder(empty));
        Assert.Equal(AddFolderResult.NoReplaysFound, svc.AddFolder(Path.Combine(_root, "does-not-exist")));
        Assert.Empty(svc.ExtraFolders);
    }

    [Fact]
    public async Task A_replay_in_an_added_folder_is_uploaded()
    {
        var other = Path.Combine(_root, "elsewhere", "Replays", "Multiplayer");
        Directory.CreateDirectory(other);
        using var svc = NewService();
        svc.Start();
        Assert.Equal(AddFolderResult.Added, svc.AddFolder(other));
        var path = Path.Combine(other, "g.SC2Replay");
        File.WriteAllBytes(path, BpmReplay());
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Single(_server.Uploads);
    }

    [Fact]
    public async Task Ladder_game_never_reaches_the_network()
    {
        using var svc = NewService();
        await svc.ProcessAsync(WriteReplay("ladder.SC2Replay", LadderReplay()), CancellationToken.None);
        Assert.Empty(_server.Uploads);
    }

    [Fact]
    public async Task Not_linked_keeps_the_game_pending_and_sends_it_after_linking()
    {
        new TokenStore(_home).Clear();
        using var svc = NewService();
        var path = WriteReplay("a.SC2Replay", BpmReplay());
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Empty(_server.Uploads);
        Assert.Equal(1, svc.PendingCount);
        Assert.Equal(ServiceState.NotLinked, svc.State);

        new TokenStore(_home).Save("fresh-token");
        svc.OnLinked();                                                  // wakes pending entries
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Equal("Bearer fresh-token", Assert.Single(_server.Uploads).Auth);
        Assert.Equal(0, svc.PendingCount);
    }

    [Fact]
    public async Task Revoked_token_is_dropped_and_the_user_is_asked_to_link_again()
    {
        _server.Reply = _ => (HttpStatusCode.Unauthorized, """{"error":"invalid or revoked token","code":"BAD_TOKEN"}""");
        using var svc = NewService();
        await svc.ProcessAsync(WriteReplay("a.SC2Replay", BpmReplay()), CancellationToken.None);
        Assert.Equal(ServiceState.NeedsRelink, svc.State);
        Assert.False(svc.IsLinked);
        Assert.Equal(1, svc.PendingCount);                               // kept, not lost
    }

    [Fact]
    public async Task Missing_consent_pauses_uploads_but_keeps_the_game()
    {
        _server.Reply = _ => (HttpStatusCode.Forbidden, """{"error":"upload consent (C1) is not granted","code":"NO_CONSENT"}""");
        using var svc = NewService();
        await svc.ProcessAsync(WriteReplay("a.SC2Replay", BpmReplay()), CancellationToken.None);
        Assert.Equal(ServiceState.NeedsConsent, svc.State);
        Assert.Equal(1, svc.PendingCount);
        Assert.True(svc.IsLinked);
    }

    [Fact]
    public async Task Server_error_is_retried_later_and_a_rejection_is_final()
    {
        _server.Reply = n => n == 1 ? (HttpStatusCode.ServiceUnavailable, "<html>bad gateway</html>") : (HttpStatusCode.UnprocessableEntity, """{"code":"NOT_REPLAY"}""");
        using var svc = NewService();
        var path = WriteReplay("a.SC2Replay", BpmReplay());

        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Equal(1, svc.PendingCount);                               // transient: waits with backoff
        await svc.ProcessAsync(path, CancellationToken.None);            // backoff has not elapsed: no second request
        Assert.Single(_server.Uploads);

        svc.OnLinked();                                                  // clears the wait (also what a manual "retry now" does)
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Equal(2, _server.Uploads.Count);
        Assert.Equal(0, svc.PendingCount);                               // 422 is final
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Equal(2, _server.Uploads.Count);
    }

    [Fact]
    public async Task An_unexpected_answer_is_retried_a_limited_number_of_times_then_dropped()
    {
        _server.Reply = _ => (HttpStatusCode.BadRequest, """{"error":"something odd"}""");
        using var svc = NewService();
        var path = WriteReplay("a.SC2Replay", BpmReplay());
        for (var i = 0; i < UploadService.MaxAttempts + 2; i++)
        {
            svc.OnLinked();                                              // clears the backoff wait
            await svc.ProcessAsync(path, CancellationToken.None);
        }
        Assert.Equal(UploadService.MaxAttempts, _server.Uploads.Count);  // stopped trying, did not hammer the server
        Assert.Equal(0, svc.PendingCount);
    }

    [Fact]
    public async Task A_rewritten_file_is_treated_as_a_new_game()
    {
        using var svc = NewService();
        var path = WriteReplay("a.SC2Replay", BpmReplay("1"));
        await svc.ProcessAsync(path, CancellationToken.None);
        File.WriteAllBytes(path, BpmReplay("22"));
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Equal(2, _server.Uploads.Count);
    }

    [Fact]
    public async Task Waits_until_the_game_has_finished_writing_the_file()
    {
        var path = Path.Combine(_replays, "growing.SC2Replay");
        var final = BpmReplay();
        File.WriteAllBytes(path, final[..20]);
        var calls = 0;
        using var svc = NewService(async (_, _) =>
        {
            calls++;
            // SC2 is still writing during the first few checks.
            if (calls == 2) File.WriteAllBytes(path, final[..(final.Length / 2)]);
            if (calls == 4) File.WriteAllBytes(path, final);
            await Task.CompletedTask;
        });

        Assert.True(await svc.WaitUntilStableAsync(path, CancellationToken.None));
        Assert.Equal(final.Length, new FileInfo(path).Length);          // it did not return on a partial file
        await svc.ProcessAsync(path, CancellationToken.None);
        Assert.Single(_server.Uploads);
    }

    [Fact]
    public async Task A_file_locked_by_the_game_is_not_read_until_released()
    {
        var path = WriteReplay("locked.SC2Replay", BpmReplay());
        using var svc = NewService();
        await using var writer = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
        Assert.False(await svc.WaitUntilStableAsync(path, CancellationToken.None, maxChecks: 5));
    }

    [Fact]
    public void Games_older_than_the_link_are_ignored()
    {
        var s = Settings.Load(_home);
        s.WatchSinceUtc = DateTime.UtcNow.AddHours(1);
        s.Save(_home);
        using var svc = NewService();
        svc.Enqueue(WriteReplay("old.SC2Replay", BpmReplay()));
        Thread.Sleep(200);
        Assert.Empty(_server.Uploads);
    }

    [Theory]
    [InlineData(200, """{"id":5}""", UploadVerdict.Accepted)]
    [InlineData(201, """{"id":5}""", UploadVerdict.Accepted)]
    [InlineData(401, """{"code":"NO_TOKEN"}""", UploadVerdict.AuthLost)]
    [InlineData(403, """{"code":"NO_CONSENT"}""", UploadVerdict.NoConsent)]
    [InlineData(403, """{"code":"BAD_ORIGIN"}""", UploadVerdict.RetryLater)]
    [InlineData(400, """{"error":"multipart/form-data expected"}""", UploadVerdict.RetryLater)]
    [InlineData(413, """{"code":"TOO_LARGE"}""", UploadVerdict.Rejected)]
    [InlineData(422, """{"code":"HASH_MISMATCH"}""", UploadVerdict.Rejected)]
    [InlineData(429, """{"code":"QUOTA"}""", UploadVerdict.RetryLater)]
    [InlineData(500, "oops", UploadVerdict.RetryLater)]
    [InlineData(502, "<html>", UploadVerdict.RetryLater)]
    public void Server_answers_map_to_the_right_next_step(int status, string body, UploadVerdict expected)
    {
        Assert.Equal(expected, ApiClient.Classify((HttpStatusCode)status, body).Verdict);
    }
}
