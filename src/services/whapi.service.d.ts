export declare class WhapiService {
    private apiUrl;
    private token;
    constructor();
    sendMessage(to: string, body: string): Promise<any>;
    sendImage(to: string, mediaUrl: string, caption?: string): Promise<any>;
}
export declare const whapiService: WhapiService;
//# sourceMappingURL=whapi.service.d.ts.map