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
      .from("invoice_reports")
      .select("*")
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
// GET INVOICE BY ID
// GET /api/invoices/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("invoice_reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch invoice",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    const invoiceAmount = Number(data.invoice_amount || 0);
    const approvedAmount = Number(data.approved_amount || 0);
    const paidAmount = Number(data.paid_amount || 0);

    const outstandingAmount = Math.max(
      approvedAmount - paidAmount,
      0
    );

    return res.json({
      success: true,

      invoice: data,

      financial: {
        invoice_amount: invoiceAmount,
        approved_amount: approvedAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount
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
// GET INVOICES BY PROJECT
// GET /api/invoices/project/:project_id
// =====================================================

router.get("/project/:project_id", async (req, res) => {
  try {
    const { project_id } = req.params;

    const { data, error } = await supabase
      .from("invoice_reports")
      .select("*")
      .eq("project_id", project_id)
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project invoices",
        error: error.message
      });
    }

    let totalInvoice = 0;
    let totalApproved = 0;
    let totalPaid = 0;

    data.forEach((invoice) => {
      totalInvoice += Number(invoice.invoice_amount || 0);
      totalApproved += Number(invoice.approved_amount || 0);
      totalPaid += Number(invoice.paid_amount || 0);
    });

    const outstandingAmount = Math.max(
      totalApproved - totalPaid,
      0
    );

    return res.json({
      success: true,

      project_id: Number(project_id),

      count: data.length,

      invoices: data,

      summary: {
        total_invoice_amount: Number(
          totalInvoice.toFixed(2)
        ),

        total_approved_amount: Number(
          totalApproved.toFixed(2)
        ),

        total_paid_amount: Number(
          totalPaid.toFixed(2)
        ),

        total_outstanding_amount: Number(
          outstandingAmount.toFixed(2)
        )
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
// GET INVOICES BY ACTIVITY
// GET /api/invoices/activity/:activity_id
// =====================================================

router.get("/activity/:activity_id", async (req, res) => {
  try {
    const { activity_id } = req.params;

    const { data, error } = await supabase
      .from("invoice_reports")
      .select("*")
      .eq("activity_id", activity_id)
      .order("id", { ascending: false });

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
      activity_id,
      inspection_request_id,
      remarks
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!project_id) {
      return res.status(400).json({
        success: false,
        message: "project_id is required"
      });
    }

    if (!activity_id) {
      return res.status(400).json({
        success: false,
        message: "activity_id is required"
      });
    }

    if (!inspection_request_id) {
      return res.status(400).json({
        success: false,
        message: "inspection_request_id is required"
      });
    }

    if (!invoice_number) {
      return res.status(400).json({
        success: false,
        message: "invoice_number is required"
      });
    }

    if (invoice_amount === undefined || invoice_amount === null) {
      return res.status(400).json({
        success: false,
        message: "invoice_amount is required"
      });
    }

    const amount = Number(invoice_amount);

    if (Number.isNaN(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        message: "invoice_amount must be a valid positive number"
      });
    }


    // -------------------------------------------------
    // VERIFY ACTIVITY
    // -------------------------------------------------

    const {
      data: activity,
      error: activityError
    } = await supabase
      .from("work_activities")
      .select("id, project_id, activity_code, activity_name")
      .eq("id", activity_id)
      .maybeSingle();

    if (activityError) {
      return res.status(500).json({
        success: false,
        message: "Failed to verify activity",
        error: activityError.message
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found"
      });
    }

    if (Number(activity.project_id) !== Number(project_id)) {
      return res.status(400).json({
        success: false,
        message: "Activity does not belong to this project"
      });
    }


    // -------------------------------------------------
    // VERIFY INSPECTION REQUEST
    // -------------------------------------------------

    const {
      data: inspection,
      error: inspectionError
    } = await supabase
      .from("inspection_requests")
      .select("*")
      .eq("id", inspection_request_id)
      .maybeSingle();

    if (inspectionError) {
      return res.status(500).json({
        success: false,
        message: "Failed to verify inspection request",
        error: inspectionError.message
      });
    }

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Inspection request not found"
      });
    }

    if (Number(inspection.project_id) !== Number(project_id)) {
      return res.status(400).json({
        success: false,
        message: "Inspection request does not belong to this project"
      });
    }

    if (Number(inspection.activity_id) !== Number(activity_id)) {
      return res.status(400).json({
        success: false,
        message: "Inspection request does not belong to this activity"
      });
    }

    if (
      inspection.status !== "APPROVED" &&
      inspection.status !== "Approved"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invoice cannot be created because inspection is not approved",
        inspection_status: inspection.status
      });
    }


    // -------------------------------------------------
    // CREATE INVOICE
    // -------------------------------------------------

    const { data, error } = await supabase
      .from("invoice_reports")
      .insert([
        {
          company_id: company_id || null,
          project_id: Number(project_id),
          user_id: user_id || null,
          invoice_number,
          invoice_date:
            invoice_date ||
            new Date().toISOString().split("T")[0],

          contractor_name:
            contractor_name || null,

          description:
            description || null,

          invoice_amount: amount,

          approved_amount: 0,

          paid_amount: 0,

          status: "PENDING",

          remarks:
            remarks || null,

          activity_id: Number(activity_id),

          inspection_request_id:
            Number(inspection_request_id)
        }
      ])
      .select()
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
    console.error("Invoice creation error:", error);

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

    const {
      data: invoice,
      error: invoiceError
    } = await supabase
      .from("invoice_reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (invoiceError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch invoice",
        error: invoiceError.message
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    const invoiceAmount =
      Number(invoice.invoice_amount || 0);

    const finalApprovedAmount =
      approved_amount === undefined ||
      approved_amount === null
        ? invoiceAmount
        : Number(approved_amount);

    if (
      Number.isNaN(finalApprovedAmount) ||
      finalApprovedAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid approved_amount"
      });
    }

    if (finalApprovedAmount > invoiceAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Approved amount cannot exceed invoice amount"
      });
    }

    const { data, error } = await supabase
      .from("invoice_reports")
      .update({
        approved_amount: finalApprovedAmount,
        status: "APPROVED",
        remarks:
          remarks || invoice.remarks || null
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to approve invoice",
        error: error.message
      });
    }

    const paidAmount =
      Number(data.paid_amount || 0);

    const outstandingAmount =
      Math.max(
        finalApprovedAmount - paidAmount,
        0
      );

    return res.json({
      success: true,
      message: "Invoice approved successfully",

      invoice: data,

      financial: {
        invoice_amount: invoiceAmount,
        approved_amount: finalApprovedAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount
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
// EXPORT
// =====================================================

module.exports = router;