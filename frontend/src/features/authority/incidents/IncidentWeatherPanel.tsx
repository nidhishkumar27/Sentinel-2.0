import { useEffect, useState } from 'react';
import { api } from '../../../services/authority/api';
import { errorMessage } from '../../../services/authority/http';
import type { IncidentWeather, WeatherNotice } from '../../../types/authority';

function clock(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function day(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function WeatherNotices({ items }: { items: WeatherNotice[] }) {
  if (!items.length) return <p className="auth-muted small">No notices in this category.</p>;

  return (
    <div className="weather-notices">
      {items.map((item, index) => (
        <div className="auth-alert auth-alert--warn" key={item.id ?? `${item.title}-${index}`}>
          <strong>{item.title}</strong>
          <p>{item.message}</p>
          {item.severity && <span className="small">Severity: {item.severity}</span>}
        </div>
      ))}
    </div>
  );
}

export default function IncidentWeatherPanel({ incidentId }: { incidentId: string }) {
  const [weather, setWeather] = useState<IncidentWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');
    setWeather(null);

    api.weatherForIncident(incidentId)
      .then((response) => {
        if (active) setWeather(response.data);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [incidentId]);

  if (loading) {
    return (
      <section className="auth-card">
        <h3>Weather Intelligence</h3>
        <p className="auth-muted">Loading weather for this incident...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="auth-card">
        <h3>Weather Intelligence</h3>
        <div className="auth-alert auth-alert--warn">{error}</div>
        <p className="auth-muted small">Weather data could not be loaded. Other incident information remains available.</p>
      </section>
    );
  }

  if (!weather) return null;

  const upcomingHours = weather.hourlyForecast
    .filter((item) => new Date(item.time).getTime() >= Date.now())
    .slice(0, 6);

  return (
    <section className="auth-card weather-panel">
      <div className="auth-row weather-heading">
        <h3>Weather Intelligence</h3>
        <span className={`weather-risk weather-risk--${weather.riskLevel.toLowerCase()}`}>
          {weather.riskLevel} risk
        </span>
      </div>

      <p className="auth-muted small">
        {weather.address ?? 'Incident location'} · {weather.location.lat.toFixed(4)}, {weather.location.lng.toFixed(4)}
      </p>

      {weather.stale && (
        <div className="auth-alert auth-alert--warn">
          Weather data may be stale ({weather.ageMinutes} minutes old).
        </div>
      )}

      <div className="weather-current">
        <div>
          <div className="weather-temperature">{Math.round(weather.current.temperatureC)}°C</div>
          <strong>{weather.current.summary}</strong>
          <p className="auth-muted small">Feels like {weather.current.apparentC}°C</p>
        </div>
        <dl className="weather-metrics">
          <dt>Rainfall</dt><dd>{weather.current.precipitationMm} mm</dd>
          <dt>Wind</dt><dd>{weather.current.windSpeedKmh} km/h</dd>
          <dt>Wind gust</dt><dd>{weather.current.windGustKmh} km/h</dd>
        </dl>
      </div>

      <h4>Upcoming hourly forecast</h4>
      {upcomingHours.length ? (
        <div className="weather-hourly">
          {upcomingHours.map((item) => (
            <div className="weather-hour" key={item.time}>
              <strong>{clock(item.time, weather.timezone)}</strong>
              <span>{Math.round(item.temperatureC)}°C</span>
              <span>{item.summary}</span>
              <small>{item.precipitationProbability}% rain</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="auth-muted small">No upcoming hourly entries are available.</p>
      )}

      <h4>7-day forecast</h4>
      <div className="auth-scroll">
        <table className="auth-table weather-daily">
          <thead>
            <tr>
              <th>Day</th><th>Conditions</th><th>Temperature</th><th>Rain</th><th>Wind gust</th>
            </tr>
          </thead>
          <tbody>
            {weather.dailyForecast.map((item) => (
              <tr key={item.date}>
                <td>{day(item.date)}</td>
                <td>{item.summary}</td>
                <td>{Math.round(item.temperatureMinC)}° / {Math.round(item.temperatureMaxC)}°C</td>
                <td>{item.precipitationProbabilityMax}% · {item.precipitationSumMm} mm</td>
                <td>{item.windGustMaxKmh} km/h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>Sentinel forecast risk indicators</h4>
      <WeatherNotices items={weather.forecastRisks} />

      <h4>Weather advisories</h4>
      <WeatherNotices items={weather.advisories} />

      <h4>Official warnings</h4>
      <div className="auth-alert auth-alert--warn">
        <strong>
          {weather.officialWarnings.status === 'not_integrated'
            ? 'Official warning feeds not integrated'
            : `Official warning status: ${weather.officialWarnings.status}`}
        </strong>
        <p>{weather.officialWarnings.message}</p>
        {weather.officialWarnings.items.length > 0 && (
          <WeatherNotices items={weather.officialWarnings.items} />
        )}
      </div>

      <p className="auth-muted small">
        Source: {weather.source.name}. Updated: {new Date(weather.fetchedAt).toLocaleString()}.
        {' '}{weather.source.note}
      </p>
    </section>
  );
}
