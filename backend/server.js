const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const supabase = require("./src/config/supabase");

// =====================================================
// ROUTES
// =====================================================

const projectsRouter = require("./src/routes/projects");
const workActivitiesRouter = require("./src/routes/workActivities");

const planningRouter = require("./src/routes/planning");
const planningControlRouter = require("./src/routes/planningControl");
const evmRouter = require("./src/routes/evm");

const resourcePlanningRouter = require("./src/routes/resourcePlanning");
const resourcePerformanceRouter = require("./src/routes/resourcePerformance");
const resourceProductivityRouter = require("./src/routes/resourceProductivity");
const resourceProductivitySummaryRouter = require("./src/routes/resourceProductivitySummary");
const resourceCostRouter = require("./src/routes/resourceCost");

const dailyProductionRouter = require("./src/routes/dailyProduction");
const dailyWorkRouter = require("./src/routes/dailyWork");
const activityControlRouter = require("./src/routes/activityControl");

// DOCUMENTS
const documentsRouter = require("./src/routes/documents");

const manpowerRouter = require("./src/routes/manpower");
const equipmentRouter = require("./src/routes/equipment");
const materialTransactionsRouter = require("./src/routes/materialTransactions");

const costSummaryRouter = require("./src/routes/costSummary");
const dailyCostsRouter = require("./src/routes/dailyCosts");

const inspectionRequestsRouter = require("./src/routes/inspectionRequests");

const invoicesRouter = require("./src/routes/invoices");
const paymentsRouter = require("./src/routes/payments");
const financialControlRouter = require("./src/routes/financialControl");

// =====================================================
// APP
// =====================================================

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    system: "AICMS",
    message: "AI Construction Management System Backend is running"
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", async (req, res) => {
  try {
    const { error } = await supabase
      .from("projects")
      .select("id")
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        status: "ERROR",
        system: "AICMS",
        message: "Supabase connection failed",
        error: error.message
      });
    }

    return res.json({
      success: true,
      status: "OK",
      system: "AICMS",
      database: "Supabase connected"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      status: "ERROR",
      system: "AICMS",
      message: error.message
    });
  }
});

// =====================================================
// API ROUTES
// =====================================================

// =====================================================
// PROJECTS
// =====================================================

app.use(
  "/api/projects",
  projectsRouter
);

// =====================================================
// WORK ACTIVITIES
// =====================================================

app.use(
  "/api/work-activities",
  workActivitiesRouter
);

// =====================================================
// PLANNING
// =====================================================

app.use(
  "/api/planning",
  planningRouter
);

// =====================================================
// PLANNING CONTROL
// =====================================================

app.use(
  "/api/planning-control",
  planningControlRouter
);

// =====================================================
// EVM
// =====================================================

app.use(
  "/api/evm",
  evmRouter
);

// =====================================================
// RESOURCE PLANNING
// =====================================================

app.use(
  "/api/resource-planning",
  resourcePlanningRouter
);

// =====================================================
// RESOURCE PERFORMANCE
// =====================================================

app.use(
  "/api/resource-performance",
  resourcePerformanceRouter
);

// =====================================================
// RESOURCE PRODUCTIVITY
// =====================================================

app.use(
  "/api/resource-productivity",
  resourceProductivityRouter
);

// =====================================================
// RESOURCE PRODUCTIVITY SUMMARY
// =====================================================

app.use(
  "/api/resource-productivity-summary",
  resourceProductivitySummaryRouter
);

// =====================================================
// RESOURCE COST
// =====================================================

app.use(
  "/api/resource-cost",
  resourceCostRouter
);

// =====================================================
// DAILY PRODUCTION
// =====================================================

app.use(
  "/api/daily-production",
  dailyProductionRouter
);

// =====================================================
// INTEGRATED DAILY WORK
// =====================================================

app.use(
  "/api/daily-work",
  dailyWorkRouter
);

// =====================================================
// ACTIVITY CONTROL
// =====================================================

app.use(
  "/api/activity-control",
  activityControlRouter
);

// =====================================================
// DOCUMENTS
// =====================================================
//
// Supports the future document workflow:
//
// Project
// Activity
// Daily Work
// Inspection
// Invoice
// Payment
//
// File examples:
// DWG / DXF / PDF / XLSX / XLS / CSV / DOCX / JPG / PNG
//
// =====================================================

app.use(
  "/api/documents",
  documentsRouter
);

// =====================================================
// MANPOWER
// =====================================================

app.use(
  "/api/manpower",
  manpowerRouter
);

// =====================================================
// EQUIPMENT
// =====================================================

app.use(
  "/api/equipment",
  equipmentRouter
);

// =====================================================
// MATERIAL TRANSACTIONS
// =====================================================

app.use(
  "/api/material-transactions",
  materialTransactionsRouter
);

// =====================================================
// COST SUMMARY
// =====================================================

app.use(
  "/api/cost-summary",
  costSummaryRouter
);

// =====================================================
// DAILY COSTS
// =====================================================

app.use(
  "/api/daily-costs",
  dailyCostsRouter
);

// =====================================================
// INSPECTION REQUESTS
// =====================================================

app.use(
  "/api/inspection-requests",
  inspectionRequestsRouter
);

// =====================================================
// INVOICES
// =====================================================

app.use(
  "/api/invoices",
  invoicesRouter
);

// =====================================================
// PAYMENTS
// =====================================================

app.use(
  "/api/payments",
  paymentsRouter
);

// =====================================================
// FINANCIAL CONTROL
// =====================================================

app.use(
  "/api/financial-control",
  financialControlRouter
);

// =====================================================
// 404 ROUTE
// =====================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message:
      "Route not found: " +
      req.method +
      " " +
      req.originalUrl
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log("-----------------------------------");
  console.log("AICMS Backend Server");
  console.log("Server running on port " + PORT);
  console.log("http://localhost:" + PORT);
  console.log("-----------------------------------");
});