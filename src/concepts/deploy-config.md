Status: PARTIAL

# Deploy Configuration

## What It Is
The scripts, Dockerfiles, and configurations required to run the application reliably in a production environment.

## Why AI-Generated Applications Often Miss It
AIs often provide naive Dockerfiles that run the application as the root user, include development dependencies in the final image, or lack proper health checks.

## Real-World Consequence
Bloated container images, privilege escalation if the container is compromised, and unreliable deployments due to missing health checks or missing build steps.

## What Bilt Can Verify
Bilt provides partial automated checks and some guided procedures.

## What Bilt Cannot Verify
Bilt cannot verify the exact host OS configurations or orchestration specifics in your Kubernetes cluster.

## How an Agent Should Inspect It
The agent should check Dockerfiles for multi-stage builds, non-root users, and minimized surface areas. It should ensure start scripts are robust.

## What a Secure Implementation Should Look Like
A slim, multi-stage Docker image running as a non-root user, containing only production dependencies, with explicitly defined health checks.
