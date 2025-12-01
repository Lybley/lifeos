# LifeOS Monitoring & Observability

Complete monitoring and observability solution for LifeOS platform.

---

## 📁 **Contents**

This directory contains all monitoring-related documentation, configuration, and instrumentation code for LifeOS.

### **Core Documents**

| File | Description |
|------|-------------|
| [MONITORING_ARCHITECTURE.md](./MONITORING_ARCHITECTURE.md) | Complete monitoring strategy, KPIs, and architecture |
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | Step-by-step setup instructions for dev and production |
| [SENTRY_INTEGRATION.md](./SENTRY_INTEGRATION.md) | Complete guide for Sentry error tracking integration |

### **Implementation Files**

| File | Description |
|------|-------------|
| [prometheus-instrumentation.ts](./prometheus-instrumentation.ts) | Prometheus metrics instrumentation code with examples |
| [grafana-dashboard.json](./grafana-dashboard.json) | Pre-configured Grafana dashboard for LifeOS |

---

## 🚀 **Quick Start**

### **For Developers**

If you're adding metrics to the codebase:

1. **Read**: [prometheus-instrumentation.ts](./prometheus-instrumentation.ts) for examples
2. **Import** the metrics in your code:
   ```typescript
   import { trackRagQuery, trackIngestion } from './config/prometheus-instrumentation';
   ```
3. **Use** the tracking functions around your operations
4. **Test**: Visit `http://localhost:8001/metrics` to verify

### **For DevOps**

If you're setting up monitoring infrastructure:

1. **Read**: [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete setup
2. **Deploy**: Prometheus + Grafana using provided commands
3. **Import**: [grafana-dashboard.json](./grafana-dashboard.json) into Grafana
4. **Configure**: Alertmanager with Slack/PagerDuty webhooks
5. **Verify**: Check Prometheus targets and Grafana dashboards

### **For Product/Analytics**

If you need to understand metrics:

1. **Read**: [MONITORING_ARCHITECTURE.md](./MONITORING_ARCHITECTURE.md) for KPIs
2. **Access**: Grafana dashboards (ask DevOps for credentials)
3. **Review**: Weekly metric reports in Slack #analytics

---

## 🎯 **Key Performance Indicators (KPIs)**

We track 6 primary KPIs:

| KPI | Target | Critical Threshold | Dashboard Panel |
|-----|--------|-------------------|-----------------|
| **Onboarding Completion Rate** | > 80% | < 60% | Executive Dashboard |
| **Data Ingestion Success Rate** | > 99% | < 95% | Engineering Dashboard |
| **RAG Response Latency (P95)** | < 3.0s | > 5.0s | Product Dashboard |
| **Action Execution Success Rate** | > 98% | < 95% | Engineering Dashboard |
| **Daily Active Users (DAU)** | Growth | 20% WoW drop | Executive Dashboard |
| **Hallucination Rate** | < 5% | > 10% | Product Dashboard |

See [MONITORING_ARCHITECTURE.md](./MONITORING_ARCHITECTURE.md) for detailed definitions and tracking methods.

---

## 📊 **Monitoring Stack**

```
┌─────────────────────────────────────────┐
│           LifeOS Platform               │
│  Backend  │  Frontend  │  Connectors    │
└─────┬───────────┬───────────┬───────────┘
      │           │           │
      ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│Prometheus│ │  Sentry  │ │ Filebeat │
│ Metrics  │ │  Errors  │ │   Logs   │
└─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │
      ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Grafana  │ │  Sentry  │ │   ELK    │
│Dashboard │ │ Dashboard│ │  Stack   │
└──────────┘ └──────────┘ └──────────┘
```

### **Components**

- **Prometheus**: Collects and stores metrics from backend services
- **Grafana**: Visualizes metrics with pre-built dashboards
- **Alertmanager**: Routes alerts to Slack/PagerDuty
- **Sentry**: Tracks errors and performance issues
- **ELK Stack** (Optional): Aggregates and analyzes logs

---

## 🔧 **Setup Status**

Track your monitoring setup progress:

### **Backend Instrumentation**
- [ ] Prometheus client installed (`yarn add prom-client`)
- [ ] Instrumentation code copied to `/backend/src/config/`
- [ ] `/metrics` endpoint exposed in server.ts
- [ ] HTTP metrics middleware added
- [ ] Custom business metrics implemented
- [ ] Sentry SDK installed and configured

### **Frontend Instrumentation**
- [ ] Sentry SDK installed (`yarn add @sentry/nextjs`)
- [ ] Sentry wizard run (`npx @sentry/wizard@latest -i nextjs`)
- [ ] Error boundary implemented
- [ ] User context tracking configured
- [ ] Performance monitoring enabled

### **Infrastructure (Kubernetes)**
- [ ] Prometheus Operator deployed
- [ ] Grafana deployed
- [ ] ServiceMonitor created for backend
- [ ] LifeOS dashboard imported
- [ ] Alert rules configured
- [ ] Alertmanager configured with Slack
- [ ] Sentry project created and DSN configured

### **Validation**
- [ ] Metrics visible in Prometheus (`/targets` shows UP)
- [ ] Grafana dashboard showing data
- [ ] Test alert fired successfully
- [ ] Sentry receiving error events
- [ ] Team has access to dashboards

---

## 📖 **Documentation Guide**

### **Where to Start?**

**👨‍💻 I'm a developer adding new features:**
→ Start with [prometheus-instrumentation.ts](./prometheus-instrumentation.ts) for code examples

**🔧 I'm setting up monitoring for the first time:**
→ Start with [SETUP_GUIDE.md](./SETUP_GUIDE.md) for step-by-step instructions

**📊 I want to understand what we're measuring:**
→ Start with [MONITORING_ARCHITECTURE.md](./MONITORING_ARCHITECTURE.md) for strategy and KPIs

**🐛 I need to set up error tracking:**
→ Start with [SENTRY_INTEGRATION.md](./SENTRY_INTEGRATION.md) for Sentry setup

**🚨 I need to configure alerts:**
→ See the "Configure Alerts" section in [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## 🎓 **Learning Resources**

### **Internal**
- [LifeOS Architecture](../docs/) - Overall system architecture
- [Kubernetes Deployment](../k8s/README.md) - K8s monitoring section
- [CI/CD Workflow](../.github/workflows/ci-cd.yaml) - Automated deployment

### **External**
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Grafana Tutorials](https://grafana.com/tutorials/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- [The RED Method](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/)

---

## 🆘 **Troubleshooting**

### **Common Issues**

| Issue | Solution |
|-------|----------|
| Metrics not showing in Prometheus | Check ServiceMonitor and `/metrics` endpoint |
| Dashboard showing "No Data" | Verify Prometheus datasource in Grafana |
| Alerts not firing | Check PrometheusRule and alert expression |
| Sentry not receiving events | Verify DSN and network connectivity |
| High cardinality warning | Review metric labels and reduce dimensions |

For detailed troubleshooting, see the [SETUP_GUIDE.md](./SETUP_GUIDE.md#troubleshooting) troubleshooting section.

---

## 📞 **Support**

### **For Monitoring Questions**
- **Slack**: #lifeos-monitoring
- **Email**: devops@lifeos.io
- **On-Call**: See PagerDuty schedule

### **For Metric Requests**
Create a ticket with:
- Metric name and description
- Labels needed
- Business justification
- Target dashboard

### **For Alert Changes**
Create a PR with:
- Alert name and expression
- Severity and thresholds
- Justification and runbook link

---

## 🔄 **Maintenance**

### **Weekly**
- Review alert fatigue (false positive rate)
- Check dashboard accuracy
- Review new metrics added

### **Monthly**
- Evaluate KPI achievement
- Review and tune alert thresholds
- Capacity planning based on metrics
- Cost optimization (metrics storage)

### **Quarterly**
- Monitoring strategy review
- Tool evaluation (new features, alternatives)
- Team training on new capabilities
- Documentation updates

---

## 📝 **Version History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12 | Initial monitoring architecture and documentation |

---

## 🤝 **Contributing**

When adding new metrics or dashboards:

1. **Follow naming conventions** from [prometheus-instrumentation.ts](./prometheus-instrumentation.ts)
2. **Update** [MONITORING_ARCHITECTURE.md](./MONITORING_ARCHITECTURE.md) with new KPIs
3. **Add examples** to instrumentation file
4. **Update dashboard** JSON if adding panels
5. **Document** in relevant guides

---

## 📄 **License**

Internal LifeOS documentation - confidential and proprietary.

---

**Last Updated**: December 2024  
**Maintained By**: LifeOS DevOps Team  
**Status**: ✅ Production Ready
