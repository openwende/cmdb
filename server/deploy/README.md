# Deployment guide

## Try it

To run the server, web UI and database together, follow the [quick start](../../README.md#quick-start).

## Local development

`server/docker-compose.yml` is for development only. It runs in debug mode, which allows the built-in JWT secret and creates demo accounts with published passwords.

```bash
make dev-db    # start PostgreSQL only, on 127.0.0.1:5432
make dev-all   # start PostgreSQL and the server, on :8080
```

The database credentials are `cmdb` / `password`.

## Production

Build the image, or use the root `compose.yaml` as a starting point:

```bash
./deploy/scripts/build.sh --name your-registry/cmdb --tag v1.0.0 --push
```

Before going live:

1. **Secrets:** set `AUTH_JWT_SECRET` to a private random value. In release mode, the server refuses to start with the values published in this repository.
2. **First account:** set `AUTH_BOOTSTRAP_ADMIN_PASSWORD`, or read the generated password from the first startup's log. Change it after signing in.
3. **Database:** use a strong `DATABASE_PASSWORD` and back up the PostgreSQL data. Apply `migrations/` with [golang-migrate](https://github.com/golang-migrate/migrate) before starting the server; the server does not run them.
4. **Network:** put the server behind a reverse proxy that terminates TLS. The API currently allows cross-origin requests from any origin, without credentials, and the `server.cors` settings have no effect. Authentication uses tokens in headers rather than cookies.

### Kubernetes

The image runs as a non-root user (UID 1001). Create a Deployment, Service and Secret, inject configuration through environment variables, and use `GET /health` for probes.

## Configuration

Environment variables are named after the configuration keys in [config.example.yaml](../config/config.example.yaml), in upper case with `.` replaced by `_`. For example, `database.host` becomes `DATABASE_HOST`, and `auth.jwt.secret` becomes `AUTH_JWT_SECRET`.
