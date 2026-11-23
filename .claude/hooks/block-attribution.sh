#!/bin/sh
command=$(jq -r '.tool_input.command // empty')
pattern='co-authored-by:.*(claude|anthropic)|generated (with|by).*claude|noreply@anthropic\.com'

if printf '%s' "$command" | grep -qE 'git[[:space:]].*commit|gh[[:space:]]+pr[[:space:]]+(create|edit|comment|merge)'; then
  if printf '%s' "$command" | grep -qiE "$pattern"; then
    jq -n '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Regra do projeto: commits e PRs não podem ter atribuição ao Claude. Remova a atribuição e tente novamente."}}'
  fi
fi
