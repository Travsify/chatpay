import axios from 'axios';
import prisma from '../utils/prisma';

export class PremblyService {
    private static async getCredentials() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return {
            appId: config?.premblyAppId || process.env.PREMBLY_APP_ID,
            secretKey: config?.premblySecret || process.env.PREMBLY_SECRET_KEY,
            baseUrl: 'https://api.prembly.com/identitypass/verification'
        };
    }

    /**
     * Vets a Nigerian Business via Corporate Affairs Commission (CAC)
     * @param rcNumber Complete RC Number e.g. RC123456 or BN123456
     * @param companyName Optional company name to match against the registry
     */
    static async verifyCAC(rcNumber: string, companyName?: string) {
        try {
            const { appId, secretKey, baseUrl } = await this.getCredentials();
            
            if (!appId || !secretKey) {
                console.log('[PREMBLY] API Keys missing. Mocking success...');
                return {
                    status: true,
                    mock: true,
                    data: {
                        company_name: companyName || 'MOCK BUSINESS NIGERIA LTD',
                        rc_number: rcNumber,
                        company_type: 'Private Company Limited by Shares',
                        company_status: 'ACTIVE',
                        directors: ['John Doe']
                    }
                };
            }

            // Official Identitypass (Prembly) CAC Advanced verification endpoint
            const response = await axios.post(`${baseUrl}/cac/advance`, {
                rc_number: rcNumber,
                company_name: companyName
            }, {
                headers: {
                    'x-api-key': secretKey,
                    'app-id': appId,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error: any) {
            console.error('[PREMBLY ERROR]', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to verify CAC via Prembly');
        }
    }
}
