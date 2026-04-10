export declare class FincraService {
    private apiUrl;
    private apiKey;
    constructor();
    createCustomer(data: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        type: 'individual' | 'business';
    }): Promise<any>;
    createVirtualAccount(data: {
        currency: string;
        accountType: 'default' | 'mapped';
        customerId: string;
    }): Promise<any>;
    getWalletBalance(walletId: string): Promise<any>;
    transferFunds(data: {
        amount: number;
        currency: string;
        destinationAddress: string;
        paymentDestination: 'fincra_wallet' | 'bank_account';
    }): Promise<any>;
}
export declare const fincraService: FincraService;
//# sourceMappingURL=fincra.service.d.ts.map