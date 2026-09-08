# Resiliency Clarification — CompanyOps (RESILIENCY-02)

You enabled the **Resiliency baseline** (Q10 = A). That baseline has **one decision the model must not make for you** and must capture before requirements are finalized: your **Recovery Time / Recovery Point objectives and Disaster Recovery strategy** (RESILIENCY-02). Your answer drives DR strategy (RESILIENCY-11), data protection (RESILIENCY-12), and regional topology (RESILIENCY-08) in the later design stages.

**Context for your choice.** CompanyOps as scoped is a hackathon/demo application: a single FastAPI process, local SQLite database, server-side task worker, and a React frontend, run on one host. The remaining resiliency decision points (change management, CI/CD, rollback, regional topology, incident response, DR testing) are being **deferred to NFR Design** per the baseline rules — this file asks only the one decision required now.

Please fill in the letter after the `[Answer]:` tag. If none fit, choose **Other** and describe. Let me know when you're done.

---

## Question R1 — RTO/RPO Goals and Disaster Recovery Strategy
What are your Recovery Time Objective (RTO) and Recovery Point Objective (RPO) goals? These determine the appropriate Disaster Recovery strategy and infrastructure redundancy level.

A) **RPO/RTO: Hours — Backup & Restore.** Lowest cost. Data backed up, no standby services. Redeploy and restore on failure. Suitable for non-critical workloads.

B) **RPO/RTO: 10s of minutes — Pilot Light.** Data live, services idle until failover. Suitable for important workloads.

C) **RPO/RTO: Minutes — Warm Standby.** Data live, services run at reduced capacity, scaled up on failover. Business-critical workloads.

D) **RPO/RTO: Near real-time — Multi-site Active/Active.** Highest cost, zero downtime. Mission-critical workloads.

E) **N/A — Single-node/single-region is acceptable; no cross-region DR needed.** Rely on local durability (SQLite file + periodic file/DB backup). Fits a hackathon/demo PoC. (Natural fit for this project's stated scope.)

X) Other (please describe after [Answer]: tag below)

[Answer]: E
