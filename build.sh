#!/usr/bin/env bash
# Build the turnier-hub container image and push it to the Scaleway
# container registry. The Nomad cluster runs linux/amd64, so the image
# is built for that platform regardless of the host architecture.
#
# Apple's `container` CLI has flaky keychain handling (status -128 on
# push), so we hand the push step off to `crane` (go-containerregistry).
# `crane` reads the password from stdin and writes its own credentials
# file (~/.docker/config.json), so no macOS keychain prompt occurs.
#
# Prerequisites:
#   - Apple `container` CLI installed
#   - `crane` installed (`brew install crane`)
#
# Usage:
#   ./build.sh                # build + push :latest (prompts for secret)
#   REGISTRY_NAMESPACE=my-namespace ./build.sh
#   IMAGE_TAG=v1.2.3 ./build.sh
#   PUSH=false ./build.sh     # build only, skip push (smoke testing)

set -euo pipefail

REGISTRY_HOST="${REGISTRY_HOST:-rg.fr-par.scw.cloud}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-}"
IMAGE_NAME="${IMAGE_NAME:-turnier-hub}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-true}"

if [[ -z "${REGISTRY_NAMESPACE}" ]]; then
    printf "Registry namespace for %s: " "${REGISTRY_HOST}"
    read -r REGISTRY_NAMESPACE
    if [[ -z "${REGISTRY_NAMESPACE}" ]]; then
        echo "ERROR: empty registry namespace." >&2
        exit 1
    fi
fi

IMAGE="${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"

cd "$(dirname "$0")"

if [[ "${PUSH}" == "true" ]]; then
    if ! command -v crane >/dev/null 2>&1; then
        echo "ERROR: crane not found. Install with: brew install crane" >&2
        exit 1
    fi

    # Ask for the Scaleway secret key up front so the long build doesn't
    # finish only to wait on a password prompt.
    printf "Scaleway secret key for %s: " "${REGISTRY_HOST}"
    # -s: silent (no echo), -r: raw (no backslash escapes).
    read -rs SCW_SECRET_KEY
    echo
    if [[ -z "${SCW_SECRET_KEY}" ]]; then
        echo "ERROR: empty secret key." >&2
        exit 1
    fi
fi

echo "==> Building ${IMAGE} for ${PLATFORM}"
container build \
    --platform "${PLATFORM}" \
    --tag "${IMAGE}" \
    .

if [[ "${PUSH}" != "true" ]]; then
    echo "==> Skipping push (PUSH=${PUSH})"
    echo "==> Done: ${IMAGE}"
    exit 0
fi

echo "==> Logging in to ${REGISTRY_HOST} (crane)"
printf '%s' "${SCW_SECRET_KEY}" | crane auth login \
    "${REGISTRY_HOST}" \
    --username nologin \
    --password-stdin

# `container image save` writes an OCI-layout tarball (index.json),
# but `crane push <tar>` expects a Docker-format tar (manifest.json).
# Extract the OCI tar into a directory and push that — `crane push`
# accepts an OCI image layout when the path is a directory.
TAR_PATH="$(mktemp -t turnier-hub.XXXXXX).tar"
LAYOUT_DIR="$(mktemp -d -t turnier-hub-layout.XXXXXX)"
trap 'rm -rf "${TAR_PATH}" "${LAYOUT_DIR}"' EXIT

echo "==> Exporting image to ${TAR_PATH}"
container image save "${IMAGE}" --output "${TAR_PATH}"

echo "==> Extracting OCI layout to ${LAYOUT_DIR}"
tar -xf "${TAR_PATH}" -C "${LAYOUT_DIR}"

echo "==> Pushing ${IMAGE}"
# `--index` is required because `container image save` writes a manifest
# list (one entry per platform) into the OCI layout.
crane push --index "${LAYOUT_DIR}" "${IMAGE}"

echo "==> Done: ${IMAGE}"
