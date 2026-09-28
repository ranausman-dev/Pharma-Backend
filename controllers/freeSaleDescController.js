import FreeSaleDesc from "../models/freeSaleDesc.js";
import { sendError, successResponse } from "../utils/response.js";

// Get paginated free sale descriptions
export const getAllFreeSaleDesc = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const search = req.query.search || "";
        const filter = search
            ? { desc: { $regex: search, $options: "i" } }  // Changed from 'name' to 'desc'
            : {};

        const freeSaleDescs = await FreeSaleDesc.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });  // Added sorting by creation date

        const total = await FreeSaleDesc.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        const hasMore = page < totalPages;

        return successResponse(res, "Free sale descriptions fetched successfully", {
            freeSaleDescs,
            currentPage: page,
            totalPages,
            totalItems: total,
            pageSize: limit,
            hasMore,
        });
    } catch (error) {
        console.error("Get Free Sale Descriptions Error:", error);
        return sendError(res, "Failed to fetch free sale descriptions", 500);
    }
};

// Create free sale description
export const createFreeSaleDesc = async (req, res) => {
    try {
        const { desc } = req.body;

        // Validate input
        if (!desc || typeof desc !== 'string' || desc.trim() === '') {
            return sendError(res, "Description is required and must be a non-empty string", 400);
        }

        // Check for existing description (case-insensitive)
        const existingDesc = await FreeSaleDesc.findOne({
            desc: { $regex: `^${desc.trim()}$`, $options: "i" }
        });

        if (existingDesc) {
            return sendError(res, "Description already exists", 409);
        }

        // Create new description
        const newDesc = await FreeSaleDesc.create({
            desc: desc.trim()
        });

        return successResponse(res, "Description created successfully", {
            description: newDesc
        }, 201);
    } catch (error) {
        console.error("Create Description Error:", error);
        return sendError(res, "Failed to create description", 500);
    }
};

const freeSaleDescController = {
    getAllFreeSaleDesc,
    createFreeSaleDesc,
};

export default freeSaleDescController;