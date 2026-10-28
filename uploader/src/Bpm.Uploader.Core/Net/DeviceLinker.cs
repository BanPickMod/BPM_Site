using Bpm.Uploader.Core.Storage;

namespace Bpm.Uploader.Core.Net;

public sealed record LinkResult(bool Success, string? Message);

/// <summary>Links this PC to an account with the device authorization flow: show a code, the user approves it in the browser.</summary>
public static class DeviceLinker
{
    /// <param name="show">Called once with the code and the page to open, so the UI can display them.</param>
    public static async Task<LinkResult> LinkAsync(Settings settings, UploaderHome home, Action<DeviceCode> show, CancellationToken ct, Func<TimeSpan, CancellationToken, Task>? delay = null)
    {
        delay ??= Task.Delay;
        if (settings.EffectiveServerUrl.Length == 0) return new LinkResult(false, "서버 주소가 설정되지 않았습니다 (settings.json의 ServerUrl 또는 BPM_SERVER_URL).");
        using var api = new ApiClient(settings.EffectiveServerUrl);
        DeviceCode code;
        try
        {
            code = await api.StartDeviceAuthAsync(ct);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            return new LinkResult(false, $"서버에 연결할 수 없습니다: {e.Message}");
        }
        show(code);

        var interval = TimeSpan.FromSeconds(Math.Max(code.Interval, 2));
        var deadline = DateTime.UtcNow.AddSeconds(code.ExpiresIn);
        while (DateTime.UtcNow < deadline)
        {
            await delay(interval, ct);
            try
            {
                var (state, token) = await api.PollDeviceTokenAsync(code.DeviceCodeValue, Environment.MachineName, ct);
                switch (state)
                {
                    case ApiClient.PollState.Ok:
                        new TokenStore(home).Save(token!);
                        settings.WatchSinceUtc = DateTime.UtcNow; // only games played from now on
                        settings.Save(home);
                        return new LinkResult(true, null);
                    case ApiClient.PollState.SlowDown:
                        interval += TimeSpan.FromSeconds(5);
                        break;
                    case ApiClient.PollState.Expired:
                        return new LinkResult(false, "코드가 만료되었습니다. 다시 시도하세요.");
                    case ApiClient.PollState.Denied:
                        return new LinkResult(false, "연결이 거부되었습니다.");
                }
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                // Transient network error while waiting for the user: keep polling until the code expires.
            }
        }
        return new LinkResult(false, "코드가 만료되었습니다. 다시 시도하세요.");
    }
}
