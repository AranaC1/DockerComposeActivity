import os
import re
import time

import psycopg2
from flask import Flask, jsonify, request

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "devsecret")

DB = {
    "host": os.getenv("DB_HOST", "db"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "name": os.getenv("DB_NAME", "appdb"),
    "user": os.getenv("DB_USER", "appuser"),
    "pass": os.getenv("DB_PASS", "changeme123"),
}


def get_conn():
    return psycopg2.connect(
        host=DB["host"],
        port=DB["port"],
        dbname=DB["name"],
        user=DB["user"],
        password=DB["pass"],
    )


def init_db(retries=10):
    """Wait for PostgreSQL and create the tasks table if it does not exist."""
    for attempt in range(retries):
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS tasks (
                            id SERIAL PRIMARY KEY,
                            title TEXT NOT NULL,
                            done BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                        """
                    )
                    conn.commit()
            print("[init_db] database is ready")
            return
        except Exception as exc:
            print(f"[init_db] waiting for db... ({attempt + 1}/{retries}) {exc}")
            time.sleep(2)
    raise RuntimeError("DB not ready after retries")


@app.get("/health")
def health():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
        return {"ok": True}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


@app.get("/tasks")
def list_tasks():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, done, created_at FROM tasks ORDER BY id;"
            )
            rows = cur.fetchall()

    return jsonify(
        [
            {
                "id": row[0],
                "title": row[1],
                "done": row[2],
                "created_at": row[3].isoformat(),
            }
            for row in rows
        ]
    )


@app.post("/tasks")
def add_task():
    data = request.get_json(silent=True) or {}
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        return {"error": "title required"}, 400

    title = title.strip()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO tasks(title) VALUES (%s) RETURNING id;",
                (title,),
            )
            new_id = cur.fetchone()[0]
            conn.commit()

    return {"id": new_id, "title": title, "done": False}, 201


@app.get("/security/info")
def security_info():
    uid = os.geteuid() if hasattr(os, "geteuid") else -1

    # A successful write at the filesystem root means the root filesystem
    # is not read-only. The probe is removed immediately if it succeeds.
    readonly = True
    test_path = "/.rw_test"
    try:
        with open(test_path, "w", encoding="utf-8") as test_file:
            test_file.write("test")
        os.remove(test_path)
        readonly = False
    except OSError:
        readonly = True

    caps = {"NoNewPrivs": None, "CapEff": None}
    try:
        with open("/proc/self/status", encoding="utf-8") as status_file:
            status = status_file.read()

        nnp_match = re.search(r"NoNewPrivs:\s*(\d+)", status)
        cap_match = re.search(r"CapEff:\s*([0-9A-Fa-f]+)", status)
        caps["NoNewPrivs"] = nnp_match.group(1) if nnp_match else None
        caps["CapEff"] = cap_match.group(1) if cap_match else None
    except OSError as exc:
        caps["error"] = str(exc)

    return jsonify(
        {
            "uid": uid,
            "readonly": readonly,
            "caps": caps,
            "env": {"HOSTNAME": os.getenv("HOSTNAME", "")},
        }
    )


# Gunicorn imports this module rather than executing it as __main__.
# Initialize the schema during import so the API works under Gunicorn too.
init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
