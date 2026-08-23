const express = require("express");
const multer = require("multer");

const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// MULTER CONFIG
// =====================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024
  }
});


// =====================================================
// ALLOWED FILE TYPES
// =====================================================

const allowedExtensions = [
  "dwg",
  "dxf",
  "xlsx",
  "xls",
  "csv",
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "jpg",
  "jpeg",
  "png",
  "zip",
  "rar"
];


// =====================================================
// GET ALL DOCUMENTS
// GET /api/documents
// =====================================================

router.get("/", async (req, res) => {

  try {

    const {
      data,
      error
    } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {

      return res.status(500).json({
        success: false,
        message: "Failed to fetch documents",
        error: error.message
      });

    }

    return res.json({
      success: true,
      count: data.length,
      documents: data
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
// GET DOCUMENTS BY ENTITY
//
// Example:
// /api/documents/entity/activity/4
// =====================================================

router.get(
  "/entity/:entity_type/:entity_id",
  async (req, res) => {

    try {

      const {
        entity_type,
        entity_id
      } = req.params;

      const {
        data,
        error
      } = await supabase
        .from("documents")
        .select("*")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .eq("status", "ACTIVE")
        .order("created_at", {
          ascending: false
        });

      if (error) {

        return res.status(500).json({
          success: false,
          message: "Failed to fetch entity documents",
          error: error.message
        });

      }

      return res.json({

        success: true,

        entity_type,

        entity_id:
          Number(entity_id),

        count: data.length,

        documents: data

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
// UPLOAD DOCUMENT
//
// POST /api/documents/upload
//
// multipart/form-data
// =====================================================

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {

    try {

      // =================================================
      // FILE CHECK
      // =================================================

      if (!req.file) {

        return res.status(400).json({
          success: false,
          message: "Please select a file"
        });

      }


      // =================================================
      // BODY
      // =================================================

      const {
        project_id,
        activity_id,
        entity_type,
        entity_id,
        document_type,
        description,
        uploaded_by
      } = req.body;


      // =================================================
      // VALIDATION
      // =================================================

      if (
        !entity_type ||
        !entity_id
      ) {

        return res.status(400).json({
          success: false,
          message:
            "entity_type and entity_id are required"
        });

      }


      const entityId =
        Number(entity_id);


      if (!Number.isFinite(entityId)) {

        return res.status(400).json({
          success: false,
          message:
            "entity_id must be a valid number"
        });

      }


      // =================================================
      // FILE EXTENSION
      // =================================================

      const originalName =
        req.file.originalname;

      const extension =
        originalName
          .split(".")
          .pop()
          .toLowerCase();


      if (
        !allowedExtensions.includes(extension)
      ) {

        return res.status(400).json({

          success: false,

          message:
            "File type is not supported",

          allowed_extensions:
            allowedExtensions

        });

      }


      // =================================================
      // SAFE FILE NAME
      // =================================================

      const timestamp =
        Date.now();

      const safeName =
        originalName
          .replace(/[^a-zA-Z0-9._-]/g, "_");


      // =================================================
      // STORAGE PATH
      // =================================================

      const projectFolder =
        project_id
          ? `project-${project_id}`
          : "general";


      const entityFolder =
        `${entity_type}-${entityId}`;


      const filePath =
        `${projectFolder}/${entityFolder}/${timestamp}-${safeName}`;


      // =================================================
      // UPLOAD TO SUPABASE STORAGE
      // =================================================

      const {
        error: storageError
      } = await supabase.storage
        .from("aicms-documents")
        .upload(
          filePath,
          req.file.buffer,
          {
            contentType:
              req.file.mimetype,

            upsert: false
          }
        );


      if (storageError) {

        return res.status(500).json({

          success: false,

          message:
            "Failed to upload file to storage",

          error:
            storageError.message

        });

      }


      // =================================================
      // SAVE DOCUMENT RECORD
      // =================================================

      const {
        data: document,
        error: documentError
      } = await supabase
        .from("documents")
        .insert({

          project_id:
            project_id
              ? Number(project_id)
              : null,

          activity_id:
            activity_id
              ? Number(activity_id)
              : null,

          entity_type,

          entity_id:
            entityId,

          document_name:
            originalName,

          document_type:
            document_type ||
            extension,

          file_url:
            filePath,

          file_path:
            filePath,

          mime_type:
            req.file.mimetype,

          file_size:
            req.file.size,

          description:
            description || null,

          uploaded_by:
            uploaded_by
              ? Number(uploaded_by)
              : null,

          status:
            "ACTIVE"

        })
        .select("*")
        .single();


      // =================================================
      // DATABASE INSERT FAILED
      // =================================================

      if (documentError) {

        // Remove uploaded file
        await supabase.storage
          .from("aicms-documents")
          .remove([
            filePath
          ]);

        return res.status(500).json({

          success: false,

          message:
            "Document record failed, uploaded file was removed",

          error:
            documentError.message

        });

      }


      // =================================================
      // SUCCESS
      // =================================================

      return res.status(201).json({

        success: true,

        message:
          "Document uploaded successfully",

        document

      });

    } catch (error) {

      console.error(
        "Document upload error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Server error",

        error:
          error.message

      });

    }

  }
);


// =====================================================
// DOWNLOAD DOCUMENT
//
// GET /api/documents/download/:id
// =====================================================

router.get(
  "/download/:id",
  async (req, res) => {

    try {

      const documentId =
        Number(req.params.id);


      if (!Number.isFinite(documentId)) {

        return res.status(400).json({
          success: false,
          message:
            "Invalid document ID"
        });

      }


      // =================================================
      // GET DOCUMENT
      // =================================================

      const {
        data: document,
        error
      } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .eq("status", "ACTIVE")
        .maybeSingle();


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to find document",
          error:
            error.message
        });

      }


      if (!document) {

        return res.status(404).json({
          success: false,
          message:
            "Document not found"
        });

      }


      // =================================================
      // CREATE SIGNED URL
      // =================================================

      const {
        data: signedUrl,
        error: signedUrlError
      } = await supabase.storage
        .from("aicms-documents")
        .createSignedUrl(
          document.file_path,
          3600
        );


      if (signedUrlError) {

        return res.status(500).json({

          success: false,

          message:
            "Failed to create download link",

          error:
            signedUrlError.message

        });

      }


      return res.json({

        success: true,

        document: {

          id:
            document.id,

          document_name:
            document.document_name,

          file_type:
            document.document_type,

          download_url:
            signedUrl.signedUrl,

          expires_in:
            3600

        }

      });

    } catch (error) {

      return res.status(500).json({

        success: false,

        message:
          "Server error",

        error:
          error.message

      });

    }

  }
);


// =====================================================
// DELETE DOCUMENT
//
// DELETE /api/documents/:id
// =====================================================

router.delete(
  "/:id",
  async (req, res) => {

    try {

      const documentId =
        Number(req.params.id);


      if (!Number.isFinite(documentId)) {

        return res.status(400).json({
          success: false,
          message:
            "Invalid document ID"
        });

      }


      const {
        data: document,
        error: findError
      } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .maybeSingle();


      if (findError) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to find document",
          error:
            findError.message
        });

      }


      if (!document) {

        return res.status(404).json({
          success: false,
          message:
            "Document not found"
        });

      }


      // =================================================
      // REMOVE STORAGE FILE
      // =================================================

      const {
        error: storageError
      } = await supabase.storage
        .from("aicms-documents")
        .remove([
          document.file_path
        ]);


      if (storageError) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to remove file from storage",
          error:
            storageError.message
        });

      }


      // =================================================
      // MARK DATABASE RECORD DELETED
      // =================================================

      const {
        data,
        error
      } = await supabase
        .from("documents")
        .update({

          status:
            "DELETED",

          updated_at:
            new Date().toISOString()

        })
        .eq("id", documentId)
        .select("*")
        .single();


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to update document status",
          error:
            error.message
        });

      }


      return res.json({

        success: true,

        message:
          "Document deleted successfully",

        document:
          data

      });

    } catch (error) {

      return res.status(500).json({

        success: false,

        message:
          "Server error",

        error:
          error.message

      });

    }

  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports = router;