import ProductType from "../models/productTypeModel.js";
import { sendError, successResponse } from "../utils/response.js";

// Get all Product Types (with pagination and search)
export const getAllProductTypes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const filter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const productTypes = await ProductType.find(filter)
      .skip(skip)
      .limit(limit);

    const total = await ProductType.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return successResponse(res, "Product types fetched", {
      productTypes,
      currentPage: page,
      totalPages,
      totalItems: total,
      pageSize: limit,
      hasMore,
    });
  } catch (error) {
    console.error("Fetch Product Types Error:", error);
    return sendError(res, "Failed to fetch product types", 500);
  }
};

// Get all Product Types (raw list for dropdowns, etc.)
export const listProductTypes = async (req, res) => {
  try {
    const types = await ProductType.find();
    return successResponse(res, "All product types", { types });
  } catch (error) {
    console.error("List Product Types Error:", error);
    return sendError(res, "Failed to list product types", 500);
  }
};

// Get Product Type by ID
export const getProductTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await ProductType.findById(id);
    if (!type) return sendError(res, "Product type not found", 404);

    return successResponse(res, "Product type found", { type });
  } catch (error) {
    console.error("Get Product Type Error:", error);
    return sendError(res, "Failed to get product type", 500);
  }
};

// Create Product Type
export const createProductType = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return sendError(res, "Name is required", 400);

    const productType = await ProductType.create({ name });
    return successResponse(res, "Product type created", { productType }, 201);
  } catch (error) {
    console.error("Create Product Type Error:", error);
    return sendError(res, "Failed to create product type", 500);
  }
};

// Update Product Type
export const updateProductType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) return sendError(res, "Name is required", 400);

    const updated = await ProductType.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );

    if (!updated) return sendError(res, "Product type not found", 404);

    return successResponse(res, "Product type updated", { productType: updated });
  } catch (error) {
    console.error("Update Product Type Error:", error);
    return sendError(res, "Failed to update product type", 500);
  }
};

// Delete Product Type
export const deleteProductType = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ProductType.findByIdAndDelete(id);
    if (!deleted) return sendError(res, "Product type not found", 404);

    return successResponse(res, "Product type deleted");
  } catch (error) {
    console.error("Delete Product Type Error:", error);
    return sendError(res, "Failed to delete product type", 500);
  }
};

// Exporting grouped controller
const productTypeController = {
  getAllProductTypes,
  listProductTypes,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
};

export default productTypeController;
