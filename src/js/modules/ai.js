/**
 * AI Module for KPI Analysis and PPT Generation
 */

export const aiModule = {
    apiKey: '',
    apiProvider: 'openai',
    apiModel: '',
    customPrompt: '',
    isAnalyzing: false,
    isGenerating: false,
    analysisResult: null,

    async init() {
        // Load saved API key
        this.apiKey = localStorage.getItem('ai_api_key') || '';
        this.apiProvider = localStorage.getItem('ai_provider') || 'openai';
        this.apiModel = localStorage.getItem('ai_model') || '';
        this.customPrompt = localStorage.getItem('ai_custom_prompt') || '';
        
        console.log('[AI] Loaded config:', { 
            key: this.apiKey ? '***' + this.apiKey.slice(-4) : 'empty', 
            provider: this.apiProvider, 
            model: this.apiModel,
            customPrompt: this.customPrompt ? 'saved' : 'empty'
        });
    },

    setApiKey(key, provider = 'openai', model = '') {
        this.apiKey = key;
        this.apiProvider = provider;
        this.apiModel = model;
        
        // Save to localStorage
        localStorage.setItem('ai_api_key', key);
        localStorage.setItem('ai_provider', provider);
        localStorage.setItem('ai_model', model);
        
        console.log('[AI] API Key saved:', { key: key ? '***' + key.slice(-4) : 'empty', provider, model });
        
        // Also save custom prompt
        if (this.customPrompt) {
            localStorage.setItem('ai_custom_prompt', this.customPrompt);
        }
        
        // Show notification through app
        const app = window.app || window.appState;
        if (app && app.showNotification) {
            app.showNotification("API key and settings saved!", "success");
        }
    },

    clearApiKey() {
        this.apiKey = '';
        this.apiModel = '';
        this.customPrompt = '';
        
        localStorage.removeItem('ai_api_key');
        localStorage.removeItem('ai_provider');
        localStorage.removeItem('ai_model');
        localStorage.removeItem('ai_custom_prompt');
        
        const app = window.app || window.appState;
        if (app && app.showNotification) {
            app.showNotification("API key cleared", "info");
        }
    },

getKPIContext() {
        // Get comprehensive KPI data for analysis
        const equipment = this.equipment || [];
        const logs = this.logs || [];
        const parts = this.allParts || [];
        const performanceData = this.performanceData || [];

        // Basic stats
        const totalEquipment = equipment.length;
        const activeEquipment = equipment.filter(e => e.Status === 'Active').length;
        const maintenanceEquipment = equipment.filter(e => e.Status === 'In Maintenance').length;
        
        // Work Orders
        const workOrders = logs.filter(l => l.woNumber);
        const totalWO = workOrders.length;
        const completedWO = workOrders.filter(l => l.Status === 'Completed').length;
        const pendingWO = workOrders.filter(l => l.Status === 'Pending').length;
        const inProgressWO = workOrders.filter(l => l.Status === 'In Progress').length;
        const approvedWO = workOrders.filter(l => l.Status === 'Approved').length;
        const rejectedWO = workOrders.filter(l => l.Status === 'Rejected').length;

        // WO by type
        const woByType = {};
        workOrders.forEach(wo => {
            const type = wo.Jenis || 'Unknown';
            woByType[type] = (woByType[type] || 0) + 1;
        });

        // WO by priority
        const woByPriority = {};
        workOrders.forEach(wo => {
            const priority = wo.woPriority || 'Normal';
            woByPriority[priority] = (woByPriority[priority] || 0) + 1;
        });

        // Downtime stats
        const downtimeLogs = logs.filter(l => l.Downtime && l.Downtime > 0);
        const totalDowntime = downtimeLogs.reduce((sum, l) => sum + (Number(l.Downtime) || 0), 0);
        const avgDowntime = downtimeLogs.length > 0 ? (totalDowntime / downtimeLogs.length).toFixed(1) : 0;

        // RCA Analysis
        const rcaStats = {};
        logs.forEach(l => {
            if (l.rca) {
                const rca = l.rca.toString().toLowerCase();
                rcaStats[rca] = (rcaStats[rca] || 0) + 1;
            }
        });
        const topRCA = Object.entries(rcaStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([rca, count]) => ({ rca, count }));

        // Parts stats
        const lowStockParts = parts.filter(p => p.stock !== undefined && p.stock < (p.minStock || 10));
        const criticalParts = parts.filter(p => p.stock !== undefined && p.stock < (p.minStock || 5));
        
        // Calculate completion rate
        const completionRate = totalWO > 0 ? ((completedWO / totalWO) * 100).toFixed(1) : 0;
        
        // Calculate avg response time (pending to completed)
        const completedWithDates = workOrders.filter(l => l.Status === 'Completed' && l.approvalDate);
        const avgResponseDays = completedWithDates.length > 0 ? 
            (completedWithDates.reduce((sum, l) => {
                const created = new Date(l.createdAt || l.Tanggal);
                const completed = new Date(l.approvalDate);
                const days = Math.ceil((completed - created) / (1000 * 60 * 60 * 24));
                return sum + days;
            }, 0) / completedWithDates.length).toFixed(1) : 0;

        return {
            // Equipment
            totalEquipment, activeEquipment, maintenanceEquipment,
            
            // Work Orders
            totalWO, completedWO, pendingWO, inProgressWO, approvedWO, rejectedWO,
            woByType, woByPriority,
            
            // Downtime
            totalDowntime, avgDowntime, downtimeCount: downtimeLogs.length,
            
            // RCA
            topRCA,
            
            // Parts
            lowStockParts: lowStockParts.length,
            criticalParts: criticalParts.length,
            topLowStock: lowStockParts.slice(0, 5).map(p => ({
                name: p.Nama,
                stock: p.stock,
                minStock: p.minStock
            })),
            
            // Calculated metrics
            completionRate, avgResponseDays
        };
    },

    async analyzeKPI() {
        // Get current API key from app state
        const app = window.app || window.appState;
        if (app) {
            this.apiKey = app.activeApiKey;
            this.apiProvider = app.aiProvider;
            this.apiModel = app.aiModel;
            this.customPrompt = app.customPrompt || '';
        }
        
        if (!this.apiKey) {
            this.showNotification("Please set API key first", "error");
            return null;
        }

        if (this.isAnalyzing) return;
        this.isAnalyzing = true;
        this.showNotification("Analyzing KPI data...", "info");

        try {
            const kpiData = this.getKPIContext();
            console.log('[AI] Provider:', this.apiProvider, 'Model:', this.apiModel);
            
            // Build smart prompt
            let prompt;
            if (this.customPrompt && this.customPrompt.trim()) {
                // Use custom prompt with data replacement
                let customP = this.customPrompt;
                customP = customP.replace(/{equipment}/g, String(kpiData.totalEquipment));
                customP = customP.replace(/{workorders}/g, String(kpiData.totalWO));
                customP = customP.replace(/{pending}/g, String(kpiData.pendingWO));
                customP = customP.replace(/{downtime}/g, String(kpiData.totalDowntime));
                customP = customP.replace(/{parts}/g, String(kpiData.lowStockParts));
                customP += '\n\n📊 *Data Overview:*\n' + this.formatKPIForPrompt(kpiData);
                prompt = customP;
            } else {
                prompt = this.buildSmartPrompt(kpiData);
            }
            
            console.log('[AI] Prompt length:', prompt.length);
            
            let result = null;
            let lastError = null;
            
            // Try with each API key
            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    result = await this.callAI(prompt);
                    if (app) {
                        app.activeKeyIndex = attempt;
                        localStorage.setItem('ai_active_key_index', String(attempt));
                    }
                    break;
                } catch (e) {
                    lastError = e;
                    const errMsg = e.message.toLowerCase();
                    if (errMsg.includes('rate limit') || errMsg.includes('quota') || errMsg.includes('insufficient') || errMsg.includes('invalid')) {
                        if (app && app.rotateApiKey) {
                            app.rotateApiKey();
                            this.apiKey = app.activeApiKey;
                        }
                    } else {
                        break;
                    }
                }
            }
            
            if (result) {
                this.analysisResult = result;
                this.showNotification("Analysis complete!", "success");
                return result;
            } else {
                this.showNotification("All API keys failed", "error");
                return null;
            }
        } catch (e) {
            console.error('AI Analysis Error:', e);
            this.showNotification("Error: " + e.message, "error");
            return null;
        } finally {
            this.isAnalyzing = false;
        }
    },

    formatKPIForPrompt(data) {
        return `📈 *Equipment:*
- Total: ${data.totalEquipment} | Active: ${data.activeEquipment} | Maintenance: ${data.maintenanceEquipment}

📋 *Work Orders:*
- Total: ${data.totalWO} | Completed: ${data.completedWO} | Pending: ${data.pendingWO} | In Progress: ${data.inProgressWO}
- Completion Rate: ${data.completionRate}%
- Avg Response Time: ${data.avgResponseDays} days

⏱️ *Downtime:*
- Total: ${data.totalDowntime} hrs | Avg: ${data.avgDowntime} hrs per incident

🔧 *Parts:*
- Low Stock: ${data.lowStockParts} | Critical: ${data.criticalParts}

🔍 *Top RCA:* ${data.topRCA.map(r => r.rca + '(' + r.count + ')').join(', ') || 'N/A'}`;
    },

    buildSmartPrompt(data) {
        return `You are a senior maintenance analyst. Analyze this data and provide actionable insights.

📊 *CURRENT DATA:*

*Equipment Status:*
- Total Assets: ${data.totalEquipment}
- Operational: ${data.activeEquipment} | In Maintenance: ${data.maintenanceEquipment}

*Work Order Performance:*
- Total WO: ${data.totalWO}
- Completed: ${data.completedWO} | Pending: ${data.pendingWO} | In Progress: ${data.inProgressWO}
- Approved: ${data.approvedWO} | Rejected: ${data.rejectedWO}
- Completion Rate: ${data.completionRate}%
- Avg Response Time: ${data.avgResponseDays} days

*Downtime Analysis:*
- Total Downtime: ${data.totalDowntime} hours
- Average per Incident: ${data.avgDowntime} hours
- Total Incidents: ${data.downtimeCount}

*Parts Inventory:*
- Low Stock Items: ${data.lowStockParts}
- Critical (Very Low): ${data.criticalParts}
${data.topLowStock.length > 0 ? '- Top Low Stock: ' + data.topLowStock.map(p => p.name + '(' + p.stock + '/' + p.minStock + ')').join(', ') : ''}

*Root Cause Analysis:*
${data.topRCA.length > 0 ? data.topRCA.map(r => '- ' + r.rca + ': ' + r.count + ' cases').join('\n') : '- No RCA data'}

Please provide:
1. 📊 *Performance Summary* - Overall health score (0-100)
2. ⚠️ *Key Issues* - Top 3 problems found
3. 🎯 *Recommendations* - Specific actionable items (priority order)
4. 📈 *Trends* - What patterns do you see?
5. 💡 *Smart Tips* - Maintenance best practices

Be specific with numbers and percentages. Format with emojis for each section.`;
    },

    async generateRecommendations() {
        const app = window.app || window.appState;
        if (!app) return [];

        const kpiData = this.getKPIContext();
        
        // Build smart prompt for recommendations
        const prompt = `Generate 5 specific maintenance work order recommendations based on this data:

📊 *Current Data:*
- Equipment: ${kpiData.totalEquipment} (${kpiData.maintenanceEquipment} in maintenance)
- Pending WO: ${kpiData.pendingWO}
- Completion Rate: ${kpiData.completionRate}%
- Downtime: ${kpiData.totalDowntime} hrs (avg: ${kpiData.avgDowntime} hrs)
- Low Stock Parts: ${kpiData.lowStockParts}
- Top RCA: ${kpiData.topRCA.slice(0, 3).map(r => r.rca).join(', ')}

Generate EXACTLY 5 work orders in this JSON format (valid JSON only, no other text):
[
  {
    "equipment": "Equipment Name or ID",
    "title": "Work Order Title",
    "description": "Detailed description",
    "priority": "High/Medium/Low",
    "type": "Preventive/Corrective/Inspection/Parts Replacement",
    "estimatedHours": 1-8
  }
]

Consider:
- High priority for equipment with downtime > 10 hrs
- Preventive maintenance for equipment > 6 months since last service
- Parts replacement for low stock items
- Inspections for equipment with RCA patterns

Output ONLY valid JSON array.`;

        try {
            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    const result = await this.callAI(prompt);
                    const parsed = JSON.parse(result);
                    
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                } catch (e) {
                    const errMsg = e.message.toLowerCase();
                    if (errMsg.includes('rate limit') || errMsg.includes('quota')) {
                        if (app.rotateApiKey) {
                            app.rotateApiKey();
                            this.apiKey = app.activeApiKey;
                        }
                    }
                }
            }
            return [];
        } catch (e) {
            console.error('Recommendations Error:', e);
            return [];
        }
    },

    buildAnalysisPrompt(data) {
        return `Analyze this maintenance KPI data and provide insights:

**Equipment Status:**
- Total Equipment: ${data.totalEquipment}
- Work Orders: ${data.totalWorkOrders} (${data.completedWO} completed, ${data.pendingWO} pending, ${data.inProgressWO} in progress)
- Total Downtime: ${data.totalDowntime} hours
- Low Stock Parts: ${data.lowStockParts} items

**Low Stock Items:**
${data.topLowStock.map(p => `- ${p.name}: ${p.stock}/${p.minStock}`).join('\n')}

Please provide:
1. Summary of maintenance performance
2. Key issues and concerns
3. Recommendations for improvement
4. Priority actions needed`;
    },

    async callAI(prompt, explicitKey = null) {
        const app = window.app || window.appState;
        
        // Use explicit key - also sync provider from app
        if (explicitKey) {
            this.apiKey = explicitKey;
            // Get provider and model from app state or localStorage
            if (app) {
                this.apiProvider = app.aiProvider || localStorage.getItem('ai_provider') || 'openrouter';
                this.apiModel = app.aiModel || localStorage.getItem('ai_model') || 'minimax/minimax-m2.5:free';
            } else {
                this.apiProvider = localStorage.getItem('ai_provider') || 'openrouter';
            }
        } else {
            // Try to get from app state or localStorage
            if (app && app.aiApiKeys && app.aiApiKeys.length > 0) {
                this.apiKey = app.aiApiKeys[0];
            } else if (app && app.activeApiKey) {
                this.apiKey = app.activeApiKey;
            } else {
                // Fallback: search all localStorage
                for (let i = 0; i < 10; i++) {
                    const key = localStorage.getItem('ai_api_key_' + i);
                    if (key) { this.apiKey = key; break; }
                }
                if (!this.apiKey) this.apiKey = localStorage.getItem('ai_api_key');
            }
            
            // Also sync provider
            this.apiProvider = localStorage.getItem('ai_provider') || 'openrouter';
            this.apiModel = localStorage.getItem('ai_model') || '';
        }
        
        console.log('[AI] Key:', this.apiKey ? '***' + this.apiKey.slice(-4) : 'EMPTY');
        console.log('[AI] Provider:', this.apiProvider);
        
        const provider = this.apiProvider || 'openrouter';
        
        console.log('[AI] Calling provider:', provider);
        
        if (provider === 'openai') {
            return await this.callOpenAI(prompt);
        } else if (provider === 'claude') {
            return await this.callClaude(prompt);
        } else {
            return await this.callOpenRouter(prompt);
        }
    },

    async callOpenRouter(prompt) {
        const model = this.apiModel || 'gpt-4o-mini';
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API request failed');
        }

        const result = await response.json();
        return result.choices[0].message.content;
    },

    async callClaude(prompt) {
        const model = this.apiModel || 'claude-3-haiku-20240307';
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API request failed');
        }

        const result = await response.json();
        return result.content[0].text;
    },

    async callOpenRouter(prompt) {
        const model = this.apiModel || 'openai/gpt-4o-mini';
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': window.location.origin || 'https://mtc-asset.web.app',
                'X-Title': 'MTC Asset'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 2000
            })
        });

        const text = await response.text();
        
        if (!response.ok) {
            let errMsg = 'API request failed';
            try {
                const err = JSON.parse(text);
                errMsg = err.error?.message || err.error || text;
            } catch (e) {
                errMsg = text;
            }
            throw new Error(errMsg);
        }

        try {
            const result = JSON.parse(text);
            return result.choices[0].message.content;
        } catch (e) {
            throw new Error('Invalid response: ' + text.substring(0, 100));
        }
    },

    async generatePPT() {
        if (!this.analysisResult) {
            this.showNotification("Please analyze KPI first", "error");
            return;
        }

        this.isGenerating = true;
        
        try {
            // Use existing export module
            const exportModule = this.exportModule;
            if (exportModule && exportModule.generateKPIPPT) {
                await exportModule.generateKPIPPT(this.analysisResult, this.getKPIContext());
                this.showNotification("PPT Generated!", "success");
            } else {
                // Fallback: generate simple text report
                await this.generateSimpleReport();
            }
        } catch (e) {
            console.error('PPT Generation Error:', e);
            this.showNotification("Failed to generate PPT", "error");
        } finally {
            this.isGenerating = false;
        }
    },

    async generateSimpleReport() {
        const kpiData = this.getKPIContext();
        const result = this.analysisResult;
        
        // Create a simple HTML report that can be printed to PDF
        const reportHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>KPI Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #1a1a2e; }
        h2 { color: #4a4a6a; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f5f5f5; }
        .metric { font-size: 24px; font-weight: bold; color: #00f2ff; }
        .section { margin: 30px 0; }
        .recommendations li { margin: 10px 0; }
    </style>
</head>
<body>
    <h1>📊 MTC Asset - KPI Analysis Report</h1>
    <p>Generated: ${new Date().toLocaleDateString()}</p>
    
    <div class="section">
        <h2>📈 Performance Metrics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Equipment</td><td class="metric">${kpiData.totalEquipment}</td></tr>
            <tr><td>Total Work Orders</td><td class="metric">${kpiData.totalWorkOrders}</td></tr>
            <tr><td>Completed</td><td class="metric">${kpiData.completedWO}</td></tr>
            <tr><td>Pending</td><td class="metric">${kpiData.pendingWO}</td></tr>
            <tr><td>In Progress</td><td class="metric">${kpiData.inProgressWO}</td></tr>
            <tr><td>Total Downtime</td><td class="metric">${kpiData.totalDowntime} hrs</td></tr>
            <tr><td>Low Stock Items</td><td class="metric">${kpiData.lowStockParts}</td></tr>
        </table>
    </div>
    
    <div class="section">
        <h2>🤖 AI Analysis</h2>
        <div style="white-space: pre-wrap;">${result}</div>
    </div>
    
    <div class="section">
        <h2>📋 Recommendations</h2>
        <ul class="recommendations">
            <li>Review and approve pending Work Orders</li>
            <li>Restock low inventory parts</li>
            <li>Analyze downtime causes</li>
            <li>Schedule preventive maintenance</li>
        </ul>
    </div>
</body>
</html>`;

        // Open in new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        
        // Auto-print after load
        printWindow.onload = () => {
            printWindow.print();
        };
        
        this.showNotification("Report generated! Press Ctrl+P to save as PDF", "success");
    }
};