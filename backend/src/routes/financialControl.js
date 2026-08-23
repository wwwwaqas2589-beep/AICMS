const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// GET FINANCIAL CONTROL BY INVOICE
// GET /api/financial-control/invoice/:invoice_id
// =====================================================

router.get("/invoice/:invoice_id", async (req, res) => {
  try {
    const { invoice_id } = req.params;

    // =================================================
    // GET INVOICE
    // =================================================

    const { data: invoice, error: invoiceError } =
      await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoice_id)
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


    // =================================================
    // GET PAYMENTS
    // =================================================

    const { data: payments, error: paymentError } =
      await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", invoice_id)
        .order("payment_date", {
          ascending: true
        });

    if (paymentError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch invoice payments",
        error: paymentError.message
      });
    }


    // =================================================
    // INVOICE VALUES
    // =================================================

    const invoiceAmount =
      Number(invoice.invoice_amount || 0);

    const approvedAmount =
      Number(invoice.approved_amount || 0);


    // =================================================
    // PAYMENT TOTALS
    // =================================================

    let totalRetention = 0;
    let totalAdvanceRecovery = 0;
    let totalDeductions = 0;
    let totalPaid = 0;

    payments.forEach((payment) => {

      totalRetention += Number(
        payment.retention_amount || 0
      );

      totalAdvanceRecovery += Number(
        payment.advance_recovery || 0
      );

      totalDeductions += Number(
        payment.deduction_amount || 0
      );

      totalPaid += Number(
        payment.paid_amount || 0
      );

    });


    // =================================================
    // NET PAYABLE
    // =================================================

    const netPayable =
      approvedAmount -
      totalRetention -
      totalAdvanceRecovery -
      totalDeductions;


    // =================================================
    // OUTSTANDING
    // =================================================

    const outstandingAmount =
      Math.max(
        netPayable - totalPaid,
        0
      );


    // =================================================
    // PAYMENT PERCENTAGE
    // =================================================

    let paymentPercentage = 0;

    if (netPayable > 0) {
      paymentPercentage =
        (totalPaid / netPayable) * 100;
    }

    paymentPercentage =
      Math.min(paymentPercentage, 100);


    // =================================================
    // STATUS
    // =================================================

    let financialStatus = "UNPAID";

    if (totalPaid > 0 && outstandingAmount > 0) {
      financialStatus = "PARTIALLY_PAID";
    }

    if (
      netPayable > 0 &&
      outstandingAmount === 0
    ) {
      financialStatus = "FULLY_PAID";
    }

    if (approvedAmount <= 0) {
      financialStatus = "PENDING_APPROVAL";
    }


    // =================================================
    // RESPONSE
    // =================================================

    return res.json({

      success: true,

      invoice: {
        id: invoice.id,

        invoice_number:
          invoice.invoice_number,

        project_id:
          invoice.project_id,

        activity_id:
          invoice.activity_id,

        invoice_date:
          invoice.invoice_date,

        contractor_name:
          invoice.contractor_name
      },


      financial_control: {

        invoice_amount:
          Number(invoiceAmount.toFixed(2)),

        approved_amount:
          Number(approvedAmount.toFixed(2)),

        total_retention:
          Number(totalRetention.toFixed(2)),

        total_advance_recovery:
          Number(totalAdvanceRecovery.toFixed(2)),

        total_deductions:
          Number(totalDeductions.toFixed(2)),

        net_payable:
          Number(netPayable.toFixed(2)),

        total_paid:
          Number(totalPaid.toFixed(2)),

        outstanding_amount:
          Number(outstandingAmount.toFixed(2)),

        payment_percentage:
          Number(paymentPercentage.toFixed(2)),

        financial_status:
          financialStatus
      },


      payment_count:
        payments.length,

      payments

    });

  } catch (error) {

    console.error(
      "Financial control error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });

  }
});


// =====================================================
// GET FINANCIAL CONTROL BY PROJECT
// GET /api/financial-control/project/:project_id
// =====================================================

router.get("/project/:project_id", async (req, res) => {
  try {

    const { project_id } = req.params;


    // =================================================
    // GET INVOICES
    // =================================================

    const { data: invoices, error: invoiceError } =
      await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", project_id)
        .order("invoice_date", {
          ascending: false
        });


    if (invoiceError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project invoices",
        error: invoiceError.message
      });
    }


    // =================================================
    // GET PAYMENTS
    // =================================================

    const { data: payments, error: paymentError } =
      await supabase
        .from("payments")
        .select("*")
        .eq("project_id", project_id);


    if (paymentError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project payments",
        error: paymentError.message
      });
    }


    // =================================================
    // PROJECT TOTALS
    // =================================================

    let totalInvoiceAmount = 0;
    let totalApprovedAmount = 0;
    let totalPaidAmount = 0;
    let totalRetention = 0;
    let totalAdvanceRecovery = 0;
    let totalDeductions = 0;


    invoices.forEach((invoice) => {

      totalInvoiceAmount += Number(
        invoice.invoice_amount || 0
      );

      totalApprovedAmount += Number(
        invoice.approved_amount || 0
      );

    });


    payments.forEach((payment) => {

      totalPaidAmount += Number(
        payment.paid_amount || 0
      );

      totalRetention += Number(
        payment.retention_amount || 0
      );

      totalAdvanceRecovery += Number(
        payment.advance_recovery || 0
      );

      totalDeductions += Number(
        payment.deduction_amount || 0
      );

    });


    // =================================================
    // NET PAYABLE
    // =================================================

    const netPayable =
      totalApprovedAmount -
      totalRetention -
      totalAdvanceRecovery -
      totalDeductions;


    // =================================================
    // OUTSTANDING
    // =================================================

    const outstandingAmount =
      Math.max(
        netPayable - totalPaidAmount,
        0
      );


    // =================================================
    // PAYMENT PERCENTAGE
    // =================================================

    let paymentPercentage = 0;

    if (netPayable > 0) {

      paymentPercentage =
        (totalPaidAmount / netPayable) * 100;

    }

    paymentPercentage =
      Math.min(paymentPercentage, 100);


    // =================================================
    // RESPONSE
    // =================================================

    return res.json({

      success: true,

      project_id:
        Number(project_id),

      financial_control: {

        total_invoices:
          invoices.length,

        total_payments:
          payments.length,

        total_invoice_amount:
          Number(totalInvoiceAmount.toFixed(2)),

        total_approved_amount:
          Number(totalApprovedAmount.toFixed(2)),

        total_retention:
          Number(totalRetention.toFixed(2)),

        total_advance_recovery:
          Number(totalAdvanceRecovery.toFixed(2)),

        total_deductions:
          Number(totalDeductions.toFixed(2)),

        net_payable:
          Number(netPayable.toFixed(2)),

        total_paid:
          Number(totalPaidAmount.toFixed(2)),

        outstanding_amount:
          Number(outstandingAmount.toFixed(2)),

        payment_percentage:
          Number(paymentPercentage.toFixed(2))

      },

      invoices,
      payments

    });

  } catch (error) {

    console.error(
      "Project financial control error:",
      error
    );

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