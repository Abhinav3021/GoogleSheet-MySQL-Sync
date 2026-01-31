"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiGet, apiPost } from "../lib/api";

const Card = ({ children }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-sm">
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "default" }) => {
  const base =
    "px-4 py-2 rounded-xl border text-sm font-semibold transition active:scale-[0.98]";
  const variants = {
    default:
      "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100",
    danger:
      "border-red-800/60 bg-red-950/40 hover:bg-red-950/70 text-red-100",
    primary:
      "border-indigo-700/50 bg-indigo-950/40 hover:bg-indigo-950/70 text-indigo-100"
  };

  return (
    <button onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
};

const Input = (props) => (
  <input
    {...props}
    className={`w-full border border-zinc-700 bg-zinc-950/40 text-zinc-100 placeholder:text-zinc-500 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 ${
      props.className || ""
    }`}
  />
);

export default function Home() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  const [rows, setRows] = useState([]);
  const [pendingOutbox, setPendingOutbox] = useState(0);

  const [id, setId] = useState("1001");
  const [name, setName] = useState("demo-user");
  const [age, setAge] = useState("25");

  const wsUrl = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_WS, []);

  const refreshData = useCallback(async () => {
    const data = await apiGet("/api/db/rows");
    if (data.ok) setRows(data.rows);

    const outbox = await apiGet("/api/outbox/stats");
    if (outbox.ok) setPendingOutbox(outbox.pending);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setEvents((prev) => [data, ...prev].slice(0, 80));
      } catch {}
    };

    const runInitial = async () => {
      await refreshData();
    };
    runInitial();

    const interval = setInterval(() => {
      refreshData();
    }, 2500);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [wsUrl, refreshData]);

  async function createOrUpdateInDb() {
    const res = await apiPost("/api/db/upsert", {
      id,
      data: { name, age }
    });
    alert(res.ok ? "✅ Upserted in DB" : `❌ ${res.error}`);
    refreshData();
  }

  async function deleteInDb() {
    const res = await apiPost("/api/db/delete", { id });
    alert(res.ok ? "✅ Deleted in DB" : `❌ ${res.error}`);
    refreshData();
  }

  async function appendInSheet() {
    const res = await apiPost("/api/sheet/append", {
      id,
      data: { name, age }
    });
    alert(res.ok ? "✅ Appended in Sheet" : `❌ ${res.error}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Live Sync Dashboard
            </h1>
            <p className="text-zinc-400 mt-1 text-sm">
              Google Sheet ↔ MySQL real-time sync monitor
            </p>
          </div>

          <div className="flex gap-2">
            <Btn onClick={refreshData}>Refresh</Btn>
          </div>
        </div>

        {/* Status bar */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <div className="p-4">
              <div className="text-zinc-400 text-xs uppercase tracking-wide">
                WebSocket
              </div>
              <div
                className={`mt-2 text-lg font-bold ${
                  connected ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {connected ? "Connected ✅" : "Disconnected ❌"}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="text-zinc-400 text-xs uppercase tracking-wide">
                Outbox Pending
              </div>
              <div className="mt-2 text-lg font-bold">{pendingOutbox}</div>
              <div className="text-zinc-500 text-xs mt-1">
                DB events waiting to be applied
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="text-zinc-400 text-xs uppercase tracking-wide">
                Rows Synced (DB)
              </div>
              <div className="mt-2 text-lg font-bold">{rows.length}</div>
              <div className="text-zinc-500 text-xs mt-1">
                Latest rows in synced_rows
              </div>
            </div>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold">Test Controls</h2>
              <span className="text-zinc-500 text-xs">
                Use buttons to trigger sync in both directions
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <Input
                placeholder="id"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
              <Input
                placeholder="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Btn onClick={createOrUpdateInDb} variant="primary">
                Upsert in DB → Sheet
              </Btn>

              <Btn onClick={deleteInDb} variant="danger">
                Delete in DB → Sheet
              </Btn>

              <Btn onClick={appendInSheet}>
                Append in Sheet → DB
              </Btn>
            </div>
          </div>
        </Card>

        {/* DB Rows */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold">DB Rows (synced_rows)</h2>
              <span className="text-zinc-500 text-xs">Showing last 50 rows</span>
            </div>

            {rows.length === 0 ? (
              <p className="text-zinc-500 mt-4">No rows synced yet…</p>
            ) : (
              <div className="space-y-3 mt-4">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div className="font-bold">
                        id=<span className="text-indigo-300">{r.id}</span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        source=<span className="text-zinc-200">{r.source}</span>
                      </div>
                    </div>

                    <pre className="mt-3 text-xs overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-200">
                      {JSON.stringify(r.row_json, null, 2)}
                    </pre>

                    {r.deleted_at && (
                      <div className="text-rose-300 font-semibold mt-3 text-sm">
                        deleted_at={r.deleted_at}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Live Events */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold">Live Events</h2>
              <span className="text-zinc-500 text-xs">
                Latest 80 events
              </span>
            </div>

            {events.length === 0 ? (
              <p className="text-zinc-500 mt-4">No events yet…</p>
            ) : (
              <div className="space-y-2 mt-4">
                {events.map((e, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"
                  >
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-200">
                        {e.type}
                      </span>
                      <span>{e.ts}</span>
                    </div>
                    <div className="mt-1 text-sm text-zinc-100">
                      {e.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
