// Deterministic post-generation checks per stage. Pure functions — no I/O.
export function runDeterministicChecks(stage: number, result: any, context: { requirements: any[] }): { passed: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (stage === 6 && result.components) {
    const componentNames = result.components.map((c: any) => c.name);
    const depGraph: Record<string, string[]> = {};
    for (const dep of result.dependency_graph || []) {
      if (!depGraph[dep.from]) depGraph[dep.from] = [];
      depGraph[dep.from].push(dep.to);
    }

    const visited = new Set<string>();
    const stack = new Set<string>();
    const hasCycle = (node: string): boolean => {
      if (stack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      stack.add(node);
      for (const neighbor of depGraph[node] || []) {
        if (hasCycle(neighbor)) return true;
      }
      stack.delete(node);
      return false;
    };
    for (const node of Object.keys(depGraph)) {
      if (hasCycle(node)) {
        errors.push(`Circular dependency detected involving: ${node}`);
        break;
      }
    }

    if (context.requirements.length > 0) {
      const coveredReqs = new Set<string>();
      for (const comp of result.components) {
        for (const req of comp.related_requirements || []) {
          coveredReqs.add(req);
        }
      }
      const allReqIds = context.requirements.map(r => r.requirement_id);
      const uncovered = allReqIds.filter(id => !coveredReqs.has(id));
      if (uncovered.length > 0) {
        warnings.push(`${uncovered.length} requirements not traced to any component: ${uncovered.slice(0, 5).join(", ")}${uncovered.length > 5 ? "..." : ""}`);
      }
    }
  }

  if (stage === 7 && result.entities) {
    const entityNames = new Set<string>(result.entities.map((e: any) => String(e.name)));
    const relEntities = new Set<string>();
    for (const rel of result.relationships || []) {
      relEntities.add(rel.from);
      relEntities.add(rel.to);
    }
    const orphans = [...entityNames].filter(e => !relEntities.has(e));
    if (orphans.length > 0 && result.entities.length > 1) {
      warnings.push(`Orphan entities with no relationships: ${orphans.join(", ")}`);
    }
  }

  if (stage === 8 && result.apis) {
    const endpoints = new Set<string>();
    for (const api of result.apis) {
      for (const ep of api.endpoints || []) {
        const key = `${ep.method} ${ep.path}`;
        if (endpoints.has(key)) {
          errors.push(`Duplicate endpoint: ${key}`);
        }
        endpoints.add(key);
      }
    }
  }

  if (stage === 9 && result.security_architecture) {
    if (!result.security_architecture.authentication_strategy) {
      errors.push("Missing authentication strategy — critical security gap");
    }
    if (!result.security_architecture.encryption) {
      warnings.push("Encryption strategy not defined");
    }
    if (!result.observability_strategy?.tracing) {
      warnings.push("Distributed tracing not defined — will impact debugging at scale");
    }
    if (!result.resilience_patterns?.circuit_breaker) {
      warnings.push("No circuit breaker pattern — risk of cascading failures");
    }
  }

  if (stage === 10 && result.deployment_topology) {
    if (!result.scaling_resilience?.disaster_recovery) {
      errors.push("Missing disaster recovery plan — no RTO/RPO defined");
    }
    if (!result.cicd_pipeline?.deployment_strategy) {
      warnings.push("No deployment strategy defined — risk of manual deployments");
    }
    if (result.cicd_pipeline?.stages && result.cicd_pipeline.stages.length < 3) {
      warnings.push("CI/CD pipeline has fewer than 3 stages — may lack adequate quality gates");
    }
    if (!Array.isArray(result.mermaid_diagrams) || result.mermaid_diagrams.length < 3) {
      warnings.push("Stage 10 expects at least 3 diagrams (deployment, network, CI/CD)");
    }
    if (!result.cost_and_readiness?.readiness_checklist) {
      warnings.push("No operational readiness checklist provided");
    }
  }

  if (stage === 11 && result.evaluations) {
    for (const evaluation of result.evaluations) {
      if (evaluation.score !== undefined) {
        if (evaluation.rating === "strong" && evaluation.score < 6) warnings.push(`${evaluation.attribute}: rated "strong" but score is ${evaluation.score}/10`);
        if (evaluation.rating === "weak" && evaluation.score > 5) warnings.push(`${evaluation.attribute}: rated "weak" but score is ${evaluation.score}/10`);
      }
    }
  }

  if (stage === 12 && result.risks) {
    const highRisks = result.risks.filter((r: any) => r.severity === "critical" || r.severity === "high");
    const unmitigated = highRisks.filter((r: any) => !r.mitigation_strategy || r.mitigation_strategy.length < 10);
    if (unmitigated.length > 0) {
      errors.push(`${unmitigated.length} high/critical risks without adequate mitigation`);
    }
  }

  return { passed: errors.length === 0, warnings, errors };
}
