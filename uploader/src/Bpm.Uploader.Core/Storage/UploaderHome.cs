using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Bpm.Uploader.Core.Storage;

/// <summary>Where the uploader keeps its files: %LOCALAPPDATA%\BPMUploader (override with BPM_UPLOADER_HOME for tests).</summary>
public sealed class UploaderHome
{
    public string Dir { get; }
    public string SettingsFile => Path.Combine(Dir, "settings.json");
    public string TokenFile => Path.Combine(Dir, "token.dat");
    public string LedgerFile => Path.Combine(Dir, "ledger.json");
    public string LogFile => Path.Combine(Dir, "uploader.log");

    public UploaderHome(string? dir = null)
    {
        Dir = dir
              ?? Environment.GetEnvironmentVariable("BPM_UPLOADER_HOME")
              ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BPMUploader");
        Directory.CreateDirectory(Dir);
    }
}

public sealed class Settings
{
    /// <summary>Site base URL. Empty means "use the value baked into the build" (see <see cref="BuildInfo"/>).</summary>
    public string? ServerUrl { get; set; }
    /// <summary>Extra replay folders besides the auto-detected StarCraft II ones.</summary>
    public List<string> ExtraReplayFolders { get; set; } = [];
    /// <summary>Where the Velopack release files live. Empty means "use the value baked into the build"; still empty means no automatic updates.</summary>
    public string? UpdateUrl { get; set; }
    public bool Paused { get; set; }
    /// <summary>Upload new games as private: the site keeps them off the public pages and out of AI training whatever the account consent says. For games that must not be exposed, such as practice matches.</summary>
    public bool UploadPrivately { get; set; }
    /// <summary>Only replays written after this moment are considered. Set when the account is linked, so old games are not swept up.</summary>
    public DateTime? WatchSinceUtc { get; set; }

    public static Settings Load(UploaderHome home) => JsonFile.Read<Settings>(home.SettingsFile) ?? new Settings();
    public void Save(UploaderHome home) => JsonFile.Write(home.SettingsFile, this);

    public string EffectiveServerUrl =>
        (Environment.GetEnvironmentVariable("BPM_SERVER_URL") is { Length: > 0 } env ? env : ServerUrl is { Length: > 0 } s ? s : BuildInfo.DefaultServerUrl)
        .TrimEnd('/');

    public string EffectiveUpdateUrl =>
        (Environment.GetEnvironmentVariable("BPM_UPDATE_URL") is { Length: > 0 } env ? env : UpdateUrl is { Length: > 0 } s ? s : BuildInfo.DefaultUpdateUrl)
        .TrimEnd('/');
}

public static class BuildInfo
{
    /// <summary>Set per release with &lt;ServerUrl&gt; in the csproj (assembly metadata). Empty in dev builds.</summary>
    public static string DefaultServerUrl =>
        typeof(BuildInfo).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == "ServerUrl")?.Value ?? "";

    public static string DefaultUpdateUrl =>
        typeof(BuildInfo).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == "UpdateUrl")?.Value ?? "";

    public static string Version => typeof(BuildInfo).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
}

/// <summary>The device token, encrypted with Windows DPAPI for the current user. Never written in clear text.</summary>
public sealed class TokenStore(UploaderHome home)
{
    public string? Load()
    {
        try
        {
            if (!File.Exists(home.TokenFile)) return null;
            var clear = ProtectedData.Unprotect(File.ReadAllBytes(home.TokenFile), null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(clear);
        }
        catch (Exception e) when (e is CryptographicException or IOException)
        {
            return null; // unreadable (other user/machine, corrupt): behave as not linked
        }
    }

    public void Save(string token) =>
        File.WriteAllBytes(home.TokenFile, ProtectedData.Protect(Encoding.UTF8.GetBytes(token), null, DataProtectionScope.CurrentUser));

    public void Clear()
    {
        if (File.Exists(home.TokenFile)) File.Delete(home.TokenFile);
    }
}

internal static class JsonFile
{
    private static readonly JsonSerializerOptions Opts = new() { WriteIndented = true, PropertyNameCaseInsensitive = true };

    public static T? Read<T>(string path)
    {
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize<T>(File.ReadAllText(path), Opts) : default;
        }
        catch (Exception e) when (e is JsonException or IOException)
        {
            return default; // corrupt state must never stop the uploader from starting
        }
    }

    /// <summary>Write via a temp file so a crash cannot leave a half-written state file.</summary>
    public static void Write<T>(string path, T value)
    {
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(value, Opts));
        File.Move(tmp, path, overwrite: true);
    }
}
