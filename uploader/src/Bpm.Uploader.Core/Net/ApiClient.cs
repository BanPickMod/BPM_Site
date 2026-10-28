using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bpm.Uploader.Core.Net;

public sealed record DeviceCode(
    [property: JsonPropertyName("device_code")] string DeviceCodeValue,
    [property: JsonPropertyName("user_code")] string UserCode,
    [property: JsonPropertyName("verification_uri")] string VerificationUri,
    [property: JsonPropertyName("verification_uri_complete")] string VerificationUriComplete,
    [property: JsonPropertyName("expires_in")] int ExpiresIn,
    [property: JsonPropertyName("interval")] int Interval);

public enum UploadVerdict
{
    /// <summary>Stored by the server (new or already known).</summary>
    Accepted,
    /// <summary>Permanent refusal for this file; do not retry.</summary>
    Rejected,
    /// <summary>The token is missing, revoked or the account is gone; the user must link again.</summary>
    AuthLost,
    /// <summary>Upload consent is not granted; nothing may be sent until it is.</summary>
    NoConsent,
    /// <summary>Temporary problem (network, server, rate limit); try again later.</summary>
    RetryLater,
}

public sealed record UploadOutcome(UploadVerdict Verdict, int? UploadId = null, string? Detail = null, TimeSpan? RetryAfter = null);

public sealed record MeInfo(string DisplayName, bool C1, bool C2, bool C3);

public enum ConsentKind
{
    Ok,
    /// <summary>401: the token is revoked or the account was deleted.</summary>
    AuthLost,
    /// <summary>Network or server trouble; the answer is unknown.</summary>
    Unavailable,
}

/// <summary>What the server holds for the three switches (C1 upload, C2 public, C3 AI training).</summary>
public sealed record ConsentCheck(ConsentKind Kind, bool C1 = false, bool C2 = false, bool C3 = false);

/// <summary>The launcher's view of the site API (see docs/BPM_Backend_Plan.md section 9). One instance per base URL.</summary>
public sealed class ApiClient : IDisposable
{
    private readonly HttpClient _http;

    public ApiClient(string baseUrl, string? token = null, HttpMessageHandler? handler = null)
    {
        _http = handler is null ? new HttpClient() : new HttpClient(handler);
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromSeconds(90);
        _http.DefaultRequestHeaders.UserAgent.ParseAdd($"BPMUploader/{Storage.BuildInfo.Version}");
        if (token is not null) _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public async Task<DeviceCode> StartDeviceAuthAsync(CancellationToken ct)
    {
        using var res = await _http.PostAsync("api/auth/device-code", null, ct);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<DeviceCode>(ct))!;
    }

    public enum PollState { Pending, SlowDown, Expired, Denied, Ok }

    public async Task<(PollState State, string? Token)> PollDeviceTokenAsync(string deviceCode, string label, CancellationToken ct)
    {
        using var res = await _http.PostAsJsonAsync("api/auth/device-token", new { device_code = deviceCode, label }, ct);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>(ct);
        if (res.IsSuccessStatusCode) return (PollState.Ok, json.GetProperty("access_token").GetString());
        return (json.TryGetProperty("error", out var e) ? e.GetString() : null) switch
        {
            "authorization_pending" => (PollState.Pending, null),
            "slow_down" => (PollState.SlowDown, null),
            "expired_token" => (PollState.Expired, null),
            _ => (PollState.Denied, null),
        };
    }

    public async Task<MeInfo?> MeAsync(CancellationToken ct)
    {
        using var res = await _http.GetAsync("api/me", ct);
        if (!res.IsSuccessStatusCode) return null;
        var j = await res.Content.ReadFromJsonAsync<JsonElement>(ct);
        var c = j.GetProperty("consent");
        return new MeInfo(j.GetProperty("displayName").GetString() ?? "", c.GetProperty("c1").GetBoolean(), c.GetProperty("c2").GetBoolean(), c.GetProperty("c3").GetBoolean());
    }

    /// <summary>Current consent. Asked before every upload so a withdrawal on the website stops the launcher before any file leaves the PC.</summary>
    public Task<ConsentCheck> GetConsentAsync(CancellationToken ct) => ConsentCall(() => _http.GetAsync("api/me/consent", ct), ct);

    public Task<ConsentCheck> SetConsentAsync(bool c1, bool c2, bool c3, CancellationToken ct) =>
        ConsentCall(() => _http.PutAsJsonAsync("api/me/consent", new { c1, c2, c3 }, ct), ct);

    private static async Task<ConsentCheck> ConsentCall(Func<Task<HttpResponseMessage>> call, CancellationToken ct)
    {
        try
        {
            using var res = await call();
            if (res.StatusCode == HttpStatusCode.Unauthorized) return new ConsentCheck(ConsentKind.AuthLost);
            if (!res.IsSuccessStatusCode) return new ConsentCheck(ConsentKind.Unavailable);
            var j = await res.Content.ReadFromJsonAsync<JsonElement>(ct);
            return new ConsentCheck(ConsentKind.Ok, j.GetProperty("c1").GetBoolean(), j.GetProperty("c2").GetBoolean(), j.GetProperty("c3").GetBoolean());
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException && !ct.IsCancellationRequested)
        {
            return new ConsentCheck(ConsentKind.Unavailable);
        }
    }

    public async Task<UploadOutcome> UploadAsync(string path, string sha256, CancellationToken ct, bool privateOnly = false)
    {
        try
        {
            await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var form = new MultipartFormDataContent();
            // .NET writes name=replay without quotes; the site's strict multipart parser requires name="replay".
            // A fixed file name also keeps the local file name (and so anything in it) off the server.
            form.Add(Part(new StreamContent(stream), "replay", "replay.SC2Replay"));
            form.Add(Part(new StringContent(sha256), "sha256"));
            form.Add(Part(new StringContent(Storage.BuildInfo.Version), "clientVersion"));
            if (privateOnly) form.Add(Part(new StringContent("private"), "visibility"));
            using var res = await _http.PostAsync("api/uploads", form, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            return Classify(res.StatusCode, body, res.Headers.RetryAfter?.Delta);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or IOException && !ct.IsCancellationRequested)
        {
            return new UploadOutcome(UploadVerdict.RetryLater, Detail: e.Message);
        }
    }

    internal static HttpContent Part(HttpContent content, string name, string? fileName = null)
    {
        content.Headers.ContentDisposition = new ContentDispositionHeaderValue("form-data") { Name = $"\"{name}\"" };
        if (fileName is not null) content.Headers.ContentDisposition.FileName = $"\"{fileName}\"";
        return content;
    }

    /// <summary>Maps the server's answer to what the uploader should do next. Public for tests.</summary>
    public static UploadOutcome Classify(HttpStatusCode status, string body, TimeSpan? retryAfter = null)
    {
        string? code = null, error = null;
        int? id = null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            code = root.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString() : null;
            error = root.TryGetProperty("error", out var er) && er.ValueKind == JsonValueKind.String ? er.GetString() : null;
            id = root.TryGetProperty("id", out var i) && i.ValueKind == JsonValueKind.Number ? i.GetInt32() : null;
        }
        catch (JsonException)
        {
            // Non-JSON body (proxy error page): fall back to the status code alone.
        }

        return (int)status switch
        {
            200 or 201 => new UploadOutcome(UploadVerdict.Accepted, id),
            401 => new UploadOutcome(UploadVerdict.AuthLost, Detail: error),
            403 when code == "NO_CONSENT" => new UploadOutcome(UploadVerdict.NoConsent, Detail: error),
            413 or 422 => new UploadOutcome(UploadVerdict.Rejected, Detail: code ?? error),
            429 => new UploadOutcome(UploadVerdict.RetryLater, Detail: "rate limited", RetryAfter: retryAfter ?? TimeSpan.FromHours(1)),
            >= 500 => new UploadOutcome(UploadVerdict.RetryLater, Detail: $"server error {(int)status}"),
            // Any other answer is unexpected (client/server version mismatch, proxy). Do not condemn the file for good:
            // the service retries with backoff and gives up after a few tries.
            _ => new UploadOutcome(UploadVerdict.RetryLater, Detail: code ?? error ?? $"HTTP {(int)status}"),
        };
    }

    public void Dispose() => _http.Dispose();
}
