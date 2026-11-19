# TinyTasks — Docker Compose Lab

This repository contains the TinyTasks API, PostgreSQL database, and frontend security dashboard.

## Project structure

```text
tinytasks/
├── app/
│   ├── app.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── docker-compose.yml
├── .env
└── README.md
```

## Run with Docker Compose

You need Docker Engine/Desktop and the Docker Compose v2 plugin on a machine that can run containers.

```bash
docker --version
docker compose version
docker compose build
docker compose up -d
docker compose ps
```

Open the frontend at <http://localhost:8084>. The API is available at <http://localhost:8083>.

## Test the API

```bash
curl http://localhost:8083/health
curl http://localhost:8083/tasks
curl -X POST http://localhost:8083/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"first task"}'
curl http://localhost:8083/tasks
```

The frontend uses `/api` on its own origin, and NGINX forwards those requests to the API service over the Compose network. This avoids hard-coding `localhost` into browser JavaScript.

## Security controls included

- API process runs as UID/GID 1000 (`appuser`).
- API container root filesystem is read-only; `/tmp` is a temporary writable filesystem.
- All Linux capabilities are dropped, with `NET_BIND_SERVICE` added back as specified in the lab guide.
- `no-new-privileges` is enabled for the API container.
- PostgreSQL has a healthcheck; the API waits for the database to become healthy.
- The API image has an HTTP healthcheck.

## Important: GitHub and DIDLab deployment

Pushing this repository to GitHub stores and versions the project files. DIDLab's Deploy tab may publish a supported website or run a supported app template, but a Git repository deployment is not automatically the same as running `docker compose`.

The DIDLab Terminal checks in this project setup showed no Docker CLI and no Docker socket. Therefore, do not claim that the Compose stack is running in DIDLab unless DIDLab provides a Docker-capable runner and you can verify the containers. The Compose stack should be run on Docker Desktop or a Docker Engine host for the Docker-specific screenshots and checks, unless your instructor confirms a supported DIDLab Docker workflow.

For a GitHub Pages/static hosting test, the `frontend` folder can be published as static files, but the dashboard's `/api` routes require the API service to be running and reachable. Static hosting alone will not provide PostgreSQL or the Docker security checks.

## Lab notes

The `.env` file contains classroom placeholder credentials only, so it is included for this assignment. Never replace these with real credentials or commit production secrets.
