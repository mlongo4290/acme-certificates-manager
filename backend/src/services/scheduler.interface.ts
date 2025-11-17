export interface IScheduler {
    scheduleRenewal(certificateId: string, renewAt: Date): Promise<void>;
    cancelRenewal(certificateId: string): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
}