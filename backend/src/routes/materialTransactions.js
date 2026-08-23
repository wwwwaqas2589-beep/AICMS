const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL MATERIAL TRANSACTIONS
// GET /api/material-transactions
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("material_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch material transactions",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      transactions: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =====================================================
// GET MATERIAL BALANCE
// GET /api/material-transactions/balance/:project_id/:material_name
// =====================================================

router.get("/balance/:project_id/:material_name", async (req, res) => {
  try {
    const { project_id, material_name } = req.params;

    const { data, error } = await supabase
      .from("material_transactions")
      .select("transaction_type, quantity, unit, total_cost")
      .eq("project_id", project_id)
      .eq("material_name", material_name);

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to calculate material balance",
        error: error.message
      });
    }

    let receipt = 0;
    let excavated = 0;
    let reused = 0;
    let consumption = 0;
    let removed = 0;
    let adjustment = 0;
    let totalCost = 0;

    data.forEach((item) => {
      const qty = Number(item.quantity || 0);

      totalCost += Number(item.total_cost || 0);

      switch (item.transaction_type) {
        case "receipt":
          receipt += qty;
          break;

        case "excavated":
          excavated += qty;
          break;

        case "reused":
          reused += qty;
          break;

        case "consumption":
          consumption += qty;
          break;

        case "removed":
          removed += qty;
          break;

        case "adjustment":
          adjustment += qty;
          break;
      }
    });

    const currentBalance =
      receipt +
      excavated +
      adjustment -
      consumption -
      removed -
      reused;

    return res.json({
      success: true,
      project_id: Number(project_id),
      material_name,

      balance: {
        receipt: Number(receipt.toFixed(2)),
        excavated: Number(excavated.toFixed(2)),
        reused: Number(reused.toFixed(2)),
        consumption: Number(consumption.toFixed(2)),
        removed: Number(removed.toFixed(2)),
        adjustment: Number(adjustment.toFixed(2)),
        current_balance: Number(currentBalance.toFixed(2)),
        total_cost: Number(totalCost.toFixed(2))
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =====================================================
// MATERIAL SUMMARY BY PROJECT
// GET /api/material-transactions/summary/:project_id
// =====================================================

router.get("/summary/:project_id", async (req, res) => {
  try {
    const { project_id } = req.params;

    const { data, error } = await supabase
      .from("material_transactions")
      .select("*")
      .eq("project_id", project_id)
      .order("material_name", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch material summary",
        error: error.message
      });
    }

    const summary = {};

    data.forEach((item) => {
      const name = item.material_name;

      if (!summary[name]) {
        summary[name] = {
          material_name: name,
          material_code: item.material_code,
          unit: item.unit || "m3",

          receipt: 0,
          consumption: 0,
          excavated: 0,
          removed: 0,
          reused: 0,
          adjustment: 0,

          current_balance: 0,
          total_cost: 0
        };
      }

      const quantity = Number(item.quantity || 0);
      const cost = Number(item.total_cost || 0);

      switch (item.transaction_type) {
        case "receipt":
          summary[name].receipt += quantity;
          break;

        case "consumption":
          summary[name].consumption += quantity;
          break;

        case "excavated":
          summary[name].excavated += quantity;
          break;

        case "removed":
          summary[name].removed += quantity;
          break;

        case "reused":
          summary[name].reused += quantity;
          break;

        case "adjustment":
          summary[name].adjustment += quantity;
          break;
      }

      summary[name].total_cost += cost;
    });

    Object.values(summary).forEach((item) => {
      item.current_balance =
        item.receipt +
        item.excavated +
        item.adjustment -
        item.consumption -
        item.removed -
        item.reused;

      item.receipt = Number(item.receipt.toFixed(2));
      item.consumption = Number(item.consumption.toFixed(2));
      item.excavated = Number(item.excavated.toFixed(2));
      item.removed = Number(item.removed.toFixed(2));
      item.reused = Number(item.reused.toFixed(2));
      item.adjustment = Number(item.adjustment.toFixed(2));

      item.current_balance = Number(
        item.current_balance.toFixed(2)
      );

      item.total_cost = Number(
        item.total_cost.toFixed(2)
      );
    });

    return res.json({
      success: true,
      project_id: Number(project_id),
      count: Object.keys(summary).length,
      materials: Object.values(summary)
    });

  } catch (error) {
    console.error("Material summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =====================================================
// DAILY MATERIAL REPORT
// GET /api/material-transactions/daily/:project_id/:date
// =====================================================

router.get("/daily/:project_id/:date", async (req, res) => {
  try {
    const { project_id, date } = req.params;

    const { data, error } = await supabase
      .from("material_transactions")
      .select("*")
      .eq("project_id", project_id)
      .eq("transaction_date", date)
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch daily material report",
        error: error.message
      });
    }

    const report = {};

    data.forEach((item) => {
      const materialName = item.material_name;

      if (!report[materialName]) {
        report[materialName] = {
          material_name: materialName,
          material_code: item.material_code,
          unit: item.unit || "m3",

          received_today: 0,
          consumed_today: 0,
          excavated_today: 0,
          removed_today: 0,
          reused_today: 0,
          adjustment_today: 0,

          total_cost_today: 0
        };
      }

      const quantity = Number(item.quantity || 0);
      const cost = Number(item.total_cost || 0);

      switch (item.transaction_type) {
        case "receipt":
          report[materialName].received_today += quantity;
          break;

        case "consumption":
          report[materialName].consumed_today += quantity;
          break;

        case "excavated":
          report[materialName].excavated_today += quantity;
          break;

        case "removed":
          report[materialName].removed_today += quantity;
          break;

        case "reused":
          report[materialName].reused_today += quantity;
          break;

        case "adjustment":
          report[materialName].adjustment_today += quantity;
          break;
      }

      report[materialName].total_cost_today += cost;
    });

    Object.values(report).forEach((item) => {
      item.received_today = Number(
        item.received_today.toFixed(2)
      );

      item.consumed_today = Number(
        item.consumed_today.toFixed(2)
      );

      item.excavated_today = Number(
        item.excavated_today.toFixed(2)
      );

      item.removed_today = Number(
        item.removed_today.toFixed(2)
      );

      item.reused_today = Number(
        item.reused_today.toFixed(2)
      );

      item.adjustment_today = Number(
        item.adjustment_today.toFixed(2)
      );

      item.total_cost_today = Number(
        item.total_cost_today.toFixed(2)
      );
    });

    return res.json({
      success: true,
      project_id: Number(project_id),
      report_date: date,
      count: Object.keys(report).length,
      materials: Object.values(report)
    });

  } catch (error) {
    console.error("Daily material report error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =====================================================
// GET MATERIAL TRANSACTION BY ID
// GET /api/material-transactions/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("material_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch material transaction",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Material transaction not found"
      });
    }

    return res.json({
      success: true,
      transaction: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =====================================================
// CREATE MATERIAL TRANSACTION
// POST /api/material-transactions
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      activity_id,
      transaction_date,
      material_name,
      material_code,
      transaction_type,
      quantity,
      unit,
      unit_rate,
      supplier_name,
      reference_no,
      remarks
    } = req.body;

    if (
      !project_id ||
      !transaction_date ||
      !material_name ||
      !transaction_type ||
      quantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "project_id, transaction_date, material_name, transaction_type and quantity are required"
      });
    }

    const validTypes = [
      "receipt",
      "consumption",
      "excavated",
      "removed",
      "reused",
      "adjustment"
    ];

    if (!validTypes.includes(transaction_type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid transaction_type. Use receipt, consumption, excavated, removed, reused or adjustment"
      });
    }

    const transactionQuantity = Number(quantity || 0);
    const rate = Number(unit_rate || 0);

    if (transactionQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: "quantity cannot be negative"
      });
    }

    const totalCost = transactionQuantity * rate;

    const { data, error } = await supabase
      .from("material_transactions")
      .insert({
        project_id,
        activity_id: activity_id || null,
        transaction_date,
        material_name,
        material_code: material_code || null,
        transaction_type,
        quantity: transactionQuantity,
        unit: unit || "m3",
        unit_rate: rate,
        total_cost: totalCost,
        supplier_name: supplier_name || null,
        reference_no: reference_no || null,
        remarks: remarks || null
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create material transaction",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Material transaction created successfully",
      transaction: data
    });

  } catch (error) {
    console.error("Material transaction error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;
