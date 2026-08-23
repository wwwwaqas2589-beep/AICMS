const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL INVOICES
// GET /api/invoices
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch invoices",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      invoices: data
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
// GET INVOICES BY PROJECT
// GET /api/invoices/project/:project_id
// =====================================================

router.get("/project/:project_id", async (req, res) => {
  try {
    const { project_id } = req.params;

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("project_id", project_id)
      .order("invoice_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project invoices",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: Number(project_id),
      count: data.length,
      invoices: data
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
// GET INVOICES BY ACTIVITY
// GET /api/invoices/activity/:activity_id
// =====================================================

router.get("/activity/:activity_id", async (req, res) => {
  try {
    const { activity_id } = req.params;

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("activity_id", activity_id)
      .order("invoice_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity invoices",
        error: error.message
      });
    }

    return res.json({
      success: true,
      activity_id: Number(activity_id),
      count: data.length,
      invoices: data
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
// GET INVOICES BY INSPECTION REQUEST
// GET /api/invoices/inspection/:inspection_request_id
// =====================================================

router.get(
  "/inspection/:inspection_request_id",
  async (req, res) => {
    try {
      const { inspection_request_id } = req.params;

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("inspection_request_id", inspection_request_id)
        .order("invoice_date", { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch inspection invoices",
          error: error.message
        });
      }

      return res.json({
        success: true,
        inspection_request_id: Number(inspection_request_id),
        count: data.length,
        invoices: data
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message
      });
    }
  }
);


// =====================================================
// CREATE INVOICE
// POST /api/invoices
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      project_id,
      user_id,
      invoice_number,
      invoice_date,
      contractor_name,
      description,
      invoice_amount,
      approved_amount,
      paid_amount,
      status,
      remarks,
      activity_id,
      inspection_request_id
    } = req.body;


    // -------------------------------------------------
    // REQUIRED FIELDS
    // -------------------------------------------------

    if (!project_id) {
      return res.status(400).json({
        success: false,
        message: "project_id is required"
      });
    }

    if (!invoice_number) {
      return res.status(400).json({
        success: false,
        message: "invoice_number is required"
      });
    }

    if (!invoice_amount) {
      return res.status(400).json({
        success: false,
        message: "invoice_amount is required"
      });
    }


    // -------------------------------------------------
    // CHECK DUPLICATE INVOICE
    // -------------------------------------------------

    const { data: existingInvoice, error: duplicateError } =
      await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_number", invoice_number)
        .maybeSingle();

    if (duplicateError) {
      return res.status(500).json({
        success: false,
        message: "Failed to check invoice number",
        error: duplicateError.message
      });
    }

    if (existingInvoice) {
      return res.status(409).json({
        success: false,
        message: "Invoice number already exists"
      });
    }


    // -------------------------------------------------
    // INSERT INVOICE
    // -------------------------------------------------

    const invoiceData = {
      company_id: company_id || null,
      project_id: Number(project_id),
      user_id: user_id || null,
      invoice_number,
      invoice_date:
        invoice_date ||
        new Date().toISOString().split("T")[0],

      contractor_name: contractor_name || null,

      description:
        description || null,

      invoice_amount:
        Number(invoice_amount),

      approved_amount:
        Number(approved_amount || 0),

      paid_amount:
        Number(paid_amount || 0),

      status:
        status || "SUBMITTED",

      remarks:
        remarks || null,

      activity_id:
        activity_id
          ? Number(activity_id)
          : null,

      inspection_request_id:
        inspection_request_id
          ? Number(inspection_request_id)
          : null
    };


    const { data, error } = await supabase
      .from("invoices")
      .insert(invoiceData)
      .select("*")
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create invoice",
        error: error.message
      });
    }


    return res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      invoice: data
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
// APPROVE INVOICE
// PATCH /api/invoices/:id/approve
// =====================================================

router.patch("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      approved_amount,
      remarks
    } = req.body;


    if (approved_amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "approved_amount is required"
      });
    }


    const { data, error } = await supabase
      .from("invoices")
      .update({
        approved_amount:
          Number(approved_amount),

        status: "APPROVED",

        remarks:
          remarks || "Invoice approved."
      })
      .eq("id", id)
      .select("*")
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to approve invoice",
        error: error.message
      });
    }


    return res.json({
      success: true,
      message: "Invoice approved successfully",
      invoice: data
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
// RECORD PAYMENT
// PATCH /api/invoices/:id/payment
// =====================================================

router.patch("/:id/payment", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      paid_amount,
      remarks
    } = req.body;


    if (paid_amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "paid_amount is required"
      });
    }


    const { data: invoice, error: fetchError } =
      await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();


    if (fetchError) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
        error: fetchError.message
      });
    }


    const newPaidAmount =
      Number(invoice.paid_amount || 0) +
      Number(paid_amount);


    const approvedAmount =
      Number(invoice.approved_amount || 0);


    let newStatus = "PARTIALLY_PAID";

    if (newPaidAmount >= approvedAmount) {
      newStatus = "PAID";
    }


    const { data, error } = await supabase
      .from("invoices")
      .update({
        paid_amount: newPaidAmount,

        status: newStatus,

        remarks:
          remarks || "Payment recorded."
      })
      .eq("id", id)
      .select("*")
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to record payment",
        error: error.message
      });
    }


    return res.json({
      success: true,
      message: "Payment recorded successfully",
      invoice: data
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