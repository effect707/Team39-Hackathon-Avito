#!/usr/bin/env bash
set -Eeuo pipefail

tag=${1:?release tag is required}
commit=${2:?release commit is required}
main_ref=${3:?main ref is required}

if [[ ! "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "release tag must match vMAJOR.MINOR.PATCH" >&2
    exit 1
fi

git rev-parse --verify "${commit}^{commit}" >/dev/null
git rev-parse --verify "${main_ref}^{commit}" >/dev/null

if ! git merge-base --is-ancestor "$commit" "$main_ref"; then
    echo "release commit is not contained in main" >&2
    exit 1
fi
