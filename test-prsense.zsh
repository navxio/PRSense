#!/usr/bin/env zsh

sandbox=$(mktemp -d)
echo "sandbox: $sandbox"

HOME=$sandbox \
XDG_CONFIG_HOME=$sandbox/.config \
XDG_DATA_HOME=$sandbox/.local/share \
  zsh -i
