import mongoose from "mongoose";
import Companies from "../models/companyModel.js";
import { sendError, successResponse } from "../utils/response.js";

// Create Company
export const createCompany = async (req, res) => {
  try {

    const { name, ptcl_number, phone_number, address, email, city, company_logo } = req.body;

    if (!name) {
      return sendError(res, "Company name is required", 400);
    }

    const company = await Companies.create({
      name,
      ptcl_number: ptcl_number || "",
      phone_number: phone_number || "",
      address: address || "",
      email: email || "",
      city: city || "",
      company_logo: company_logo || "",
    });

    return successResponse(res, "Company created successfully", { company }, 201);
  } catch (error) {
    console.error("Create Company Error:", error);
    return sendError(res, "Failed to create company", 500);
  }
};


// Get All Companies with Pagination
export const getAllCompanies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const companies = await Companies.find().skip(skip).limit(limit).sort({ createdAt: -1 });
    const totalItems = await Companies.countDocuments();
    const totalPages = Math.ceil(totalItems / limit);
    const hasMore = page < totalPages;

    return successResponse(res, "Companies fetched successfully", {
      companies,
      currentPage: page,
      totalPages,
      totalItems,
      pageSize: limit,
      hasMore,
    });
  } catch (error) {
    console.error("Get All Companies Error:", error);
    return sendError(res, "Failed to fetch companies", 500);
  }
};

// Get Single Company by ID
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Companies.findById(id);

    if (!company) return sendError(res, "Company not found", 404);

    return successResponse(res, "Company fetched successfully", { company }, 200);
  } catch (error) {
    console.error("Get Company By ID Error:", error);
    return sendError(res, "Failed to fetch company", 500);
  }
};

// Update Company
export const updateCompany = async (req, res) => {
  try {

    const { id } = req.params;

    // Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid company ID", 400);
    }

    const updateData = {};
    const allowedFields = ['name', 'ptcl_number', 'phone_number', 'address', 'company_logo', 'email', 'city'];

    // Build update data
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });


    if (Object.keys(updateData).length === 0) {
      return sendError(res, "At least one field must be provided for update", 400);
    }

    const company = await Companies.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true // Ensure validators run
      }
    );


    if (!company) {
      return sendError(res, "Company not found", 404);
    }

    return successResponse(res, "Company updated successfully", { company }, 200);
  } catch (error) {
    console.error("Update Company Error:", error);
    console.error("Error details:", error.message, error.stack);
    return sendError(res, "Failed to update company: " + error.message, 500);
  }
};
// Delete Company
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Companies.findByIdAndDelete(id);

    if (!company) return sendError(res, "Company not found", 404);

    return successResponse(res, "Company deleted successfully", {}, 200);
  } catch (error) {
    console.error("Delete Company Error:", error);
    return sendError(res, "Failed to delete company", 500);
  }
};

const companyController = {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
};

export default companyController;
