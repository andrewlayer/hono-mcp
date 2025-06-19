interface SettingsProps {
  onChange?: (settings: SettingsState) => void;
  settings: SettingsState;
}

interface SettingsState {
  serverUrl: string;
  apiKey: string;
}

export function Settings({ onChange, settings }: SettingsProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange?.({ ...settings, [name]: value });
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      color: 'white'
    }}>
      <h2>Settings</h2>
      <form>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Server URL:
          </label>
          <input
            type="text"
            name="serverUrl"
            value={settings.serverUrl}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: 'white'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            API Key:
          </label>
          <input
            type="password"
            name="apiKey"
            value={settings.apiKey}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: 'white'
            }}
          />
        </div>
      </form>
    </div>
  );
}
