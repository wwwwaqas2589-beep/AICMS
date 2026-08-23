const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// GET ALL PAYMENTS
// GET /api/payments
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payments",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      payments: data
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
// GET PAYMENT BY ID
// GET /api/payments/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payment",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    return res.json({
      success: true,
      payment: data
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
// GET PAYMENTS BY PROJECT
// GET /api/payments/project/:project_id
// =====================================================

router.get("/project/:project_id", async (req, res) => {
  try {
    const { project_id } = req.params;

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("project_id", project_id)
      .order("payment_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project payments",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: Number(project_id),
      count: data.length,
      payments: data
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
// GET PAYMENTS BY INVOICE
// GET /api/payments/invoice/:invoice_id
// =====================================================

router.get("/invoice/:invoice_id", async (req, res) => {
  try {
    const { invoice_id } = req.params;

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", invoice_id)
      .order("payment_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch invoice payments",
        error: error.message
      });
    }

    return res.json({
      success: true,
      invoice_id: Number(invoice_id),
      count: data.length,
      payments: data
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
// CREATE PAYMENT
// POST /api/payments
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      project_id,
      user_id,
      invoice_id,
      payment_number,
      payment_date,
      invoice_amount,
      approved_amount,
      retention_amount,
      advance_recovery,
      deduction_amount,
      paid_amount,
      payment_method,
      reference_number,
      status,
      remarks
    } = req.body;

    if (!project_id) {
      return res.status(400).json({
        success: false,
        message: "project_id is required"
      });
    }

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        message: "invoice_id is required"
      });
    }

    if (!payment_number) {
      return res.status(400).json({
        success: false,
        message: "payment_number is required"
      });
    }

    // -------------------------------------------------
    // VERIFY INVOICE
    // -------------------------------------------------

    const { data: invoice, error: invoiceError } =
      await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoice_id)
        .maybeSingle();

    if (invoiceError) {
      return res.status(500).json({
        success: false,
        message: "Failed to verify invoice",
        error: invoiceError.message
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    // -------------------------------------------------
    // CREATE PAYMENT
    // -------------------------------------------------

    const paymentData = {
      company_id: company_id || invoice.company_id,
      project_id,
      user_id: user_id || invoice.user_id,
      invoice_id,

      payment_number,
      payment_date: payment_date || new Date().toISOString().split("T")[0],

      invoice_amount: Number(
        invoice_amount !== undefined
          ? invoice_amount
          : invoice.invoice_amount || 0
      ),

      approved_amount: Number(
        approved_amount !== undefined
          ? approved_amount
          : invoice.approved_amount || 0
      ),

      retention_amount: Number(retention_amount || 0),
      advance_recovery: Number(advance_recovery || 0),
      deduction_amount: Number(deduction_amount || 0),

      paid_amount: Number(paid_amount || 0),

      payment_method: payment_method || null,
      reference_number: reference_number || null,

      status: status || "PENDING",

      remarks: remarks || null
    };

    const { data, error } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create payment",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Payment created successfully",
      payment: data
    });

  } catch (error) {
    console.error("Payment creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// UPDATE PAYMENT STATUS
// PATCH /api/payments/:id/status
// =====================================================

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required"
      });
    }

    const updateData = {
      status
    };

    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }

    const { data, error } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update payment status",
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: "Payment status updated successfully",
      payment: data
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
// EXPORT
// =====================================================

module.exports = router;