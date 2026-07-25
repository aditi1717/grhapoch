import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { categoryAllowsFoodType, normalizeFoodTypeForCategory } from '../../shared/categoryWorkflow.js';
import { isHostedUploadUrl, saveImageFromUrl } from '../../../../services/storage.service.js';

const PREP_TIME_OPTIONS = [
    '5-10 mins', '10-15 mins', '15-20 mins', '20-25 mins', 
    '25-30 mins', '30-40 mins', '40-50 mins', '50+ mins'
];

const TEMPLATE_SAMPLE_ROW_SIGNATURE = Object.freeze({
    category: 'starters',
    name: 'paneer tikka',
    description: 'spicy marinated paneer grilled to perfection',
    price: 250,
    foodType: 'veg',
    prepTime: '20-25 mins',
    imageUrl: 'https://example.com/paneer.jpg',
    variants: [
        { name: 'half', price: 150 },
        { name: 'full', price: 280 }
    ]
});

const isLegacyTemplateSampleRow = (data = {}) => {
    const normalizedVariants = Array.isArray(data.variants)
        ? data.variants.map((v) => ({
            name: String(v?.name || '').trim().toLowerCase(),
            price: Number(v?.price || 0)
        }))
        : [];

    if (normalizedVariants.length !== TEMPLATE_SAMPLE_ROW_SIGNATURE.variants.length) return false;

    const variantsMatch = TEMPLATE_SAMPLE_ROW_SIGNATURE.variants.every((sampleVariant, idx) => {
        const rowVariant = normalizedVariants[idx];
        return (
            rowVariant &&
            rowVariant.name === sampleVariant.name &&
            rowVariant.price === sampleVariant.price
        );
    });

    if (!variantsMatch) return false;

    return (
        String(data.category || '').trim().toLowerCase() === TEMPLATE_SAMPLE_ROW_SIGNATURE.category &&
        String(data.name || '').trim().toLowerCase() === TEMPLATE_SAMPLE_ROW_SIGNATURE.name &&
        String(data.description || '').trim().toLowerCase() === TEMPLATE_SAMPLE_ROW_SIGNATURE.description &&
        Number(data.price || 0) === TEMPLATE_SAMPLE_ROW_SIGNATURE.price &&
        String(data.foodType || '').trim().toLowerCase() === TEMPLATE_SAMPLE_ROW_SIGNATURE.foodType &&
        String(data.prepTime || '').trim().toLowerCase() === TEMPLATE_SAMPLE_ROW_SIGNATURE.prepTime &&
        String(data.imageUrl || '').trim().toLowerCase() === TEMPLATE_SAMPLE_ROW_SIGNATURE.imageUrl
    );
};

/**
 * Generates an Excel template for bulk menu upload.
 */
export async function generateBulkMenuTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Menu Template');

    // Define Columns
    sheet.columns = [
        { header: 'Category*', key: 'category', width: 20 },
        { header: 'Item Name*', key: 'name', width: 30 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Base Price*', key: 'price', width: 15 },
        { header: 'Food Type (Veg/Non-Veg)*', key: 'foodType', width: 25 },
        { header: 'Recommended (Yes/No)', key: 'isRecommended', width: 25 },
        { header: 'Preparation Time*', key: 'prepTime', width: 25 },
        { header: 'Image URL', key: 'imageUrl', width: 40 },
        { header: 'Variant 1 Name', key: 'v1Name', width: 20 },
        { header: 'Variant 1 Price', key: 'v1Price', width: 15 },
        { header: 'Variant 2 Name', key: 'v2Name', width: 20 },
        { header: 'Variant 2 Price', key: 'v2Price', width: 15 },
        { header: 'Variant 3 Name', key: 'v3Name', width: 20 },
        { header: 'Variant 3 Price', key: 'v3Price', width: 15 },
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Add Data Validations for 500 rows
    for (let i = 2; i <= 501; i++) {
        // Food Type Dropdown
        sheet.getCell(`E${i}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"Veg,Non-Veg"']
        };

        // Recommended Dropdown
        sheet.getCell(`F${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Yes,No"']
        };

        // Preparation Time Dropdown
        sheet.getCell(`G${i}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`"${PREP_TIME_OPTIONS.join(',')}"`]
        };

        // Numeric Validation for Prices
        const priceCells = [`D${i}`, `J${i}`, `L${i}`, `N${i}`];
        priceCells.forEach(cell => {
            sheet.getCell(cell).dataValidation = {
                type: 'decimal',
                operator: 'greaterThanOrEqual',
                showErrorMessage: true,
                allowBlank: true,
                formulae: [0],
                errorTitle: 'Invalid Price',
                error: 'Price must be a number greater than or equal to 0'
            };
        });
    }

    return workbook;
}

/**
 * Processes the uploaded bulk menu Excel file.
 */
export async function processBulkMenuUpload(restaurantId, fileBuffer, options = {}) {
    const approvalStatus = options.approvalStatus === 'approved' ? 'approved' : 'pending';
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) throw new ValidationError('Invalid Excel file: worksheet missing');

    const normalizeHeader = (value) =>
        String(value || '')
            .trim()
            .replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase();

    const headerRow = sheet.getRow(1);
    const colMap = {
        category: 1,
        name: 2,
        description: 3,
        price: 4,
        foodType: 5,
        isRecommended: 6,
        prepTime: 7,
        imageUrl: 8,
        v1Name: 9,
        v1Price: 10,
        v2Name: 11,
        v2Price: 12,
        v3Name: 13,
        v3Price: 14
    };

    let hasCategoryHeader = false;
    let hasNameHeader = false;

    if (headerRow && headerRow.values) {
        headerRow.eachCell((cell, colNumber) => {
            const norm = normalizeHeader(cell.value);
            if (norm.includes('category')) {
                colMap.category = colNumber;
                hasCategoryHeader = true;
            } else if (norm.includes('item name') || (norm.includes('name') && !norm.includes('variant') && !norm.includes('v1') && !norm.includes('v2') && !norm.includes('v3'))) {
                colMap.name = colNumber;
                hasNameHeader = true;
            } else if (norm.includes('description')) {
                colMap.description = colNumber;
            } else if (norm.includes('price') && !norm.includes('variant') && !norm.includes('v1') && !norm.includes('v2') && !norm.includes('v3')) {
                colMap.price = colNumber;
            } else if (norm.includes('food type') || norm === 'type' || norm.includes('veg')) {
                colMap.foodType = colNumber;
            } else if (norm.includes('recommended')) {
                colMap.isRecommended = colNumber;
            } else if (norm.includes('prep') || norm.includes('time')) {
                colMap.prepTime = colNumber;
            } else if (norm.includes('image') || norm.includes('url') || norm.includes('photo')) {
                colMap.imageUrl = colNumber;
            } else if (norm.includes('variant 1 name') || norm.includes('variant1 name') || norm.includes('v1 name')) {
                colMap.v1Name = colNumber;
            } else if (norm.includes('variant 1 price') || norm.includes('variant1 price') || norm.includes('v1 price')) {
                colMap.v1Price = colNumber;
            } else if (norm.includes('variant 2 name') || norm.includes('variant2 name') || norm.includes('v2 name')) {
                colMap.v2Name = colNumber;
            } else if (norm.includes('variant 2 price') || norm.includes('variant2 price') || norm.includes('v2 price')) {
                colMap.v2Price = colNumber;
            } else if (norm.includes('variant 3 name') || norm.includes('variant3 name') || norm.includes('v3 name')) {
                colMap.v3Name = colNumber;
            } else if (norm.includes('variant 3 price') || norm.includes('variant3 price') || norm.includes('v3 price')) {
                colMap.v3Price = colNumber;
            }
        });
    }

    const restaurant = await FoodRestaurant.findById(restaurantId).lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    const items = [];
    const parsingErrors = [];
    const maxItems = 500;
    let rowCount = 0;

    const getNumericValue = (cell) => {
        if (!cell || cell.value === null || cell.value === undefined) return 0;
        if (typeof cell.value === 'object' && cell.value.result !== undefined) {
            return parseFloat(cell.value.result) || 0;
        }
        return parseFloat(cell.value) || 0;
    };

    const getTextValue = (cell) => {
        if (!cell || cell.value === null || cell.value === undefined) return '';
        
        // Handle Hyperlinks (often how URLs are stored in Excel)
        if (typeof cell.value === 'object') {
            if (cell.value.hyperlink) return String(cell.value.hyperlink).trim();
            if (cell.value.text) return String(cell.value.text).trim();
        }
        
        // Handle Rich Text
        if (cell.value.richText) {
            return cell.value.richText.map(rt => rt.text).join('').trim();
        }
        
        // Handle Formula Result
        if (typeof cell.value === 'object' && cell.value.result !== undefined) {
            return String(cell.value.result).trim();
        }
        
        // Handle Shared Strings / Plain Values
        return String(cell.value).trim();
    };

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip Header
        if (rowCount >= maxItems) return;

        try {
            const rawFoodType = getTextValue(row.getCell(colMap.foodType));
            const rawPrepTime = getTextValue(row.getCell(colMap.prepTime));

            const data = {
                category: getTextValue(row.getCell(colMap.category)),
                name: getTextValue(row.getCell(colMap.name)),
                description: getTextValue(row.getCell(colMap.description)),
                price: getNumericValue(row.getCell(colMap.price)),
                foodType: rawFoodType || 'Veg',
                isRecommended: String(row.getCell(colMap.isRecommended).value || '').toLowerCase() === 'yes',
                prepTime: rawPrepTime || '15-20 mins',
                imageUrl: getTextValue(row.getCell(colMap.imageUrl)),
                variants: []
            };

            // Mandatory Field Check
            if (!data.category || !data.name) {
                // Only report as error if row is not completely empty
                const hasAnyData = row.values.some(v => v !== null && v !== undefined && v !== '');
                if (hasAnyData) {
                    parsingErrors.push({
                        row: rowNumber,
                        item: data.name || 'Unknown Entry',
                        error: 'Category and Item Name are mandatory'
                    });
                }
                return;
            }

            rowCount++;

            // Parse Variants
            const v1N = getTextValue(row.getCell(colMap.v1Name));
            const v1P = getNumericValue(row.getCell(colMap.v1Price));
            if (v1N && v1P > 0) data.variants.push({ name: v1N, price: v1P });

            const v2N = getTextValue(row.getCell(colMap.v2Name));
            const v2P = getNumericValue(row.getCell(colMap.v2Price));
            if (v2N && v2P > 0) data.variants.push({ name: v2N, price: v2P });

            const v3N = getTextValue(row.getCell(colMap.v3Name));
            const v3P = getNumericValue(row.getCell(colMap.v3Price));
            if (v3N && v3P > 0) data.variants.push({ name: v3N, price: v3P });

            // Backward compatibility guard:
            // Old templates had a pre-filled sample row (Paneer Tikka). Skip it automatically.
            if (isLegacyTemplateSampleRow(data)) {
                return;
            }

            items.push({ data, rowNumber });
        } catch (err) {
            parsingErrors.push({
                row: rowNumber,
                item: getTextValue(row.getCell(2)) || 'Unknown Entry',
                error: `Parsing error: ${err.message}`
            });
        }
    });

    if (items.length === 0 && parsingErrors.length === 0) {
        throw new ValidationError('No valid items found in the Excel sheet');
    }

    const totalProcessedRows = items.length + parsingErrors.length;
    const results = {
        success: 0,
        failed: parsingErrors.length,
        details: [...parsingErrors]
    };

    // --- OPTIMIZATION: Resolve All Categories First ---
    const categoryCache = new Map();
    const uniqueCategoryNames = [...new Set(items.map(it => it.data.category))];
    
    for (const catName of uniqueCategoryNames) {
        const normalized = catName.trim();
        let cat = await FoodCategory.findOne({
            name: { $regex: new RegExp(`^${escapeRegExp(normalized)}$`, 'i') },
            $or: [{ restaurantId: null }, { restaurantId: restaurant._id }]
        });

        if (!cat) {
            cat = await FoodCategory.create({
                name: normalized,
                restaurantId: restaurant._id,
                createdByRestaurantId: restaurant._id,
                approvalStatus: 'approved',
                isActive: true
            });
        }
        categoryCache.set(normalized.toLowerCase(), cat);
    }

    // --- OPTIMIZATION: Batch process items with concurrency ---
    const CONCURRENCY = 10;
    const itemChunks = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
        itemChunks.push(items.slice(i, i + CONCURRENCY));
    }

    const bulkOps = [];

    for (const chunk of itemChunks) {
        const chunkPromises = chunk.map(async (item) => {
            try {
                const { data, rowNumber } = item;

                // 1. Get Pre-Resolved Category
                const category = categoryCache.get(data.category.toLowerCase());
                if (!category) throw new Error(`Category ${data.category} could not be resolved`);

                // 2. Handle Image Parallel Upload
                let finalImageUrl = '';
                if (data.imageUrl) {
                    const trimmedUrl = data.imageUrl.trim();
                    // Keep already-hosted URLs (local VPS or legacy Cloudinary)
                    if (isHostedUploadUrl(trimmedUrl) || trimmedUrl.includes('cloudinary.com')) {
                        finalImageUrl = trimmedUrl;
                    } else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('//')) {
                        try {
                            const urlToUpload = trimmedUrl.startsWith('//') ? `https:${trimmedUrl}` : trimmedUrl;
                            const saved = await saveImageFromUrl(
                                urlToUpload,
                                `restaurants/${restaurantId}/food`
                            );
                            finalImageUrl = saved.url;
                        } catch (imgErr) {
                            console.error(`Row ${rowNumber}: Image upload failed [${trimmedUrl}]:`, imgErr.message);
                        }
                    }
                }

                // 3. Prepare Bulk Operation
                const normalizedFoodType = normalizeFoodTypeForCategory(data.foodType);
                const categoryScope = String(category?.foodTypeScope || 'Both').trim();
                if (!categoryAllowsFoodType(categoryScope, normalizedFoodType)) {
                    throw new Error(
                        `Category "${category.name}" allows only ${categoryScope} items, but row has ${normalizedFoodType}`
                    );
                }

                bulkOps.push({
                    updateOne: {
                        filter: { name: data.name, restaurantId: restaurant._id },
                        update: {
                            $set: {
                                categoryId: category._id,
                                categoryName: category.name,
                                description: data.description,
                                price: data.variants.length > 0 ? Math.min(...data.variants.map(v => v.price)) : data.price,
                                variants: data.variants,
                                ...(finalImageUrl && { image: finalImageUrl }),
                                foodType: normalizedFoodType,
                                isRecommended: data.isRecommended,
                                preparationTime: data.prepTime,
                                approvalStatus,
                                ...(approvalStatus === 'pending'
                                    ? { requestedAt: new Date(), approvedAt: null }
                                    : { approvedAt: new Date(), requestedAt: null }),
                                rejectionReason: '',
                                rejectedAt: null
                            }
                        },
                        upsert: true
                    }
                });

            } catch (err) {
                results.failed++;
                results.details.push({
                    row: item.rowNumber,
                    item: item?.data?.name || 'Unknown Entry',
                    error: err.message
                });
            }
        });

        await Promise.all(chunkPromises);
    }

    // --- OPTIMIZATION: Execute Bulk Write ---
    if (bulkOps.length > 0) {
        try {
            await FoodItem.bulkWrite(bulkOps);
        } catch (bulkErr) {
            console.error('Bulk write failed:', bulkErr.message);
            results.details.push({ row: 'N/A', error: `Database saving failed: ${bulkErr.message}` });
        }
    }

    results.success = Math.max(0, totalProcessedRows - results.failed);

    if (results.success > 0) {
        try {
            const { invalidateCache } = await import('../../../../middleware/cache.js');
            await invalidateCache(`restaurant_menu:${restaurantId}`);
        } catch (cacheErr) {
            console.error('Failed to invalidate cache after bulk upload:', cacheErr);
        }
    }

    return results;
}

/**
 * Escapes characters for use in a regular expression.
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
