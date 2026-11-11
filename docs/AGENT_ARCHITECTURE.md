# Multi-agent architecture

## Roles
- Operations explainer: answers from documented campaign status and procedures.
- Reconciliation reviewer: summarizes payment events and flags mismatches to an authorized operator.
- Compliance checklist assistant: tracks missing approvals and evidence from documented state.
- Support drafter: prepares neutral responses for human review.

## Strict financial boundary
This project is pre-production for financial operations. Preserve `FINANCIAL_PRODUCTION_APPROVED=false`, provider manual mode, and Asaas sandbox until legal, operational, and payment homologation is complete. Agents must never change these gates.

Agents cannot create, confirm, or refund payments; alter Pix data; approve sellers; reserve or transfer tickets; perform draws; change campaign rules; access payer evidence beyond existing authorization; or trigger webhooks. Financial state remains deterministic and governed by existing controls.

## Acceptance
All analysis is read-only, auditable, and tied to existing identifiers. Missing approval is a blocker, never inferred complete.
