
ledgerRoute.get("/transactionExportExcel", authenticateUser, async (req, res) => {
    try {
        // Set extended timeout
        req.setTimeout(600000);
        res.setTimeout(600000);

        const { userData: { _id: userId }, role } = req.userData;
        const { exportExcel, startDate, endDate, transactionType, statusType } = req.query;
        
        // Base query optimization
        const query = role === "admin" ? {} : { userId };
        
        // Optimize date filtering
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        }

        if (statusType) {
            query.status = statusType;
        }

        // Model configuration mapping
        const modelConfig = {
            payout: {
                model: Payout,
                select: "-updatedAt -_id -type -userId",
                populate: {
                    path: "beneficiary",
                    select: "beneficiaryName beneficiaryAccountNo beneficiaryIfscCode"
                },
                transform: (item) => ({
                    transactionId: item.transactionId,
                    amount: item.amount,
                    status: item.status,
                    createdAt: item.createdAt,
                    utrNumber: item.utrNumber || '',
                    beneficiaryName: item.beneficiary?.beneficiaryName || '',
                    beneficiaryAccountNo: item.beneficiary?.beneficiaryAccountNo || '',
                    beneficiaryIfscCode: item.beneficiary?.beneficiaryIfscCode || ''
                })
            },
            payin: {
                model: Payin,
                select: "amount currency order_id vpa senderName date txn_id status",
                transform: (item) => item
            },
            topup: {
                model: Topup,
                select: "points type createdAt",
                transform: (item) => item
            },
            fundrequest: {
                model: Fundrequest,
                select: "amount utr status feedback createdAt",
                transform: (item) => item
            }
        };

        const config = modelConfig[transactionType?.toLowerCase()];
        if (!config) {
            return res.status(400).json({ message: "Invalid transaction type" });
        }

        // Process in chunks
        const chunkSize = 1000;
        let processedData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            // Fetch data in chunks with lean query
            const dataQuery = config.model.find(query)
                .select(config.select)
                .lean()
                .skip(page * chunkSize)
                .limit(chunkSize);

            if (config.populate) {
                dataQuery.populate(config.populate);
            }

            const chunk = await dataQuery.exec();
            
            if (chunk.length === 0) {
                hasMore = false;
                continue;
            }

            // Transform the chunk data
            const transformedChunk = chunk.map(config.transform);
            processedData = processedData.concat(transformedChunk);
            
            page++;

            // Prevent event loop blocking
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (exportExcel === "true") {
            // Set response headers for Excel
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${transactionType}_${new Date().toISOString()}.xlsx`);

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(processedData, {
                header: Object.keys(processedData[0] || {}),
                dateNF: 'yyyy-mm-dd'
            });

            // Auto-size columns
            const colWidths = Object.keys(processedData[0] || {}).map(() => ({ wch: 15 }));
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

            // Write file buffer and send response
            const buffer = XLSX.write(wb, { 
                type: 'buffer', 
                bookType: 'xlsx',
                compression: true 
            });

            return res.end(buffer);
        }

        res.status(200).json(processedData);

    } catch (error) {
        console.error("Error in /transactionExportExcel route:", error);
        res.status(500).json({ 
            message: "Internal server error", 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        });
    }
});

// Add this helper function if you need more custom Excel formatting
function formatExcelDate(date) {
    return date ? new Date(date).toISOString().split('T')[0] : '';
}




