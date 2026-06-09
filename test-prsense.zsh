#!/usr/bin/env zsh

sandbox=$(mktemp -d)
echo "sandbox: $sandbox"

export HOME=$sandbox
export XDG_CONFIG_HOME=$sandbox/.config
export XDG_DATA_HOME=$sandbox/.local/share
