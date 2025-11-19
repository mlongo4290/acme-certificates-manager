import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { SshKey, SshKeyService } from '../../services/ssh-key.service';

@Component({
    selector: 'app-ssh-keys',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        ButtonModule,
        TableModule,
        DialogModule,
        InputTextModule,
        InputNumberModule,
        SelectModule,
        TextareaModule,
        TooltipModule,
        ConfirmDialogModule,
        ToastModule
    ],
    templateUrl: './ssh-keys.html'
})
export class SshKeysComponent {
    private sshKeyService = inject(SshKeyService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private translateService = inject(TranslateService);

    @ViewChild('dt') table: any;

    keys: SshKey[] = [];
    totalRecords = 0;
    displayDialog = false;
    isNewKey = false;
    loading = false;
    saving = false;
    testing = false;
    generating = false;

    keyForm: any = {
        name: '',
        description: '',
        privateKey: '',
        publicKey: '',
        keyType: 'ed25519',
        keySize: undefined,
        username: 'root',
        port: 22
    };

    keyTypes = [
        // Classic algorithms
        { label: 'Ed25519 (Recommended)', value: 'ed25519' },
        { label: 'RSA', value: 'rsa' },
        { label: 'RSA-PSS', value: 'rsa-pss' },
        { label: 'EC (Elliptic Curve)', value: 'ec' },
        { label: 'DSA', value: 'dsa' },
        { label: 'DH (Diffie-Hellman)', value: 'dh' },

        // Edwards-curve
        { label: 'Ed448', value: 'ed448' },
        { label: 'X25519', value: 'x25519' },
        { label: 'X448', value: 'x448' },

        // Post-quantum ML-DSA
        { label: 'ML-DSA-44', value: 'ml-dsa-44' },
        { label: 'ML-DSA-65', value: 'ml-dsa-65' },
        { label: 'ML-DSA-87', value: 'ml-dsa-87' },

        // Post-quantum ML-KEM
        { label: 'ML-KEM-512', value: 'ml-kem-512' },
        { label: 'ML-KEM-768', value: 'ml-kem-768' },
        { label: 'ML-KEM-1024', value: 'ml-kem-1024' },

        // Post-quantum SLH-DSA SHA2
        { label: 'SLH-DSA-SHA2-128f', value: 'slh-dsa-sha2-128f' },
        { label: 'SLH-DSA-SHA2-128s', value: 'slh-dsa-sha2-128s' },
        { label: 'SLH-DSA-SHA2-192f', value: 'slh-dsa-sha2-192f' },
        { label: 'SLH-DSA-SHA2-192s', value: 'slh-dsa-sha2-192s' },
        { label: 'SLH-DSA-SHA2-256f', value: 'slh-dsa-sha2-256f' },
        { label: 'SLH-DSA-SHA2-256s', value: 'slh-dsa-sha2-256s' },

        // Post-quantum SLH-DSA SHAKE
        { label: 'SLH-DSA-SHAKE-128f', value: 'slh-dsa-shake-128f' },
        { label: 'SLH-DSA-SHAKE-128s', value: 'slh-dsa-shake-128s' },
        { label: 'SLH-DSA-SHAKE-192f', value: 'slh-dsa-shake-192f' },
        { label: 'SLH-DSA-SHAKE-192s', value: 'slh-dsa-shake-192s' },
        { label: 'SLH-DSA-SHAKE-256f', value: 'slh-dsa-shake-256f' },
        { label: 'SLH-DSA-SHAKE-256s', value: 'slh-dsa-shake-256s' }
    ];

    keySizeOptions: { [key: string]: { label: string, value: number }[] } = {
        rsa: [
            { label: '2048 bits', value: 2048 },
            { label: '3072 bits', value: 3072 },
            { label: '4096 bits (Recommended)', value: 4096 },
            { label: '8192 bits', value: 8192 }
        ],
        'rsa-pss': [
            { label: '2048 bits', value: 2048 },
            { label: '3072 bits', value: 3072 },
            { label: '4096 bits (Recommended)', value: 4096 },
            { label: '8192 bits', value: 8192 }
        ],
        ec: [
            { label: 'prime256v1 (256 bits)', value: 256 },
            { label: 'secp384r1 (384 bits)', value: 384 },
            { label: 'secp521r1 (521 bits)', value: 521 }
        ],
        dsa: [
            { label: '2048 bits', value: 2048 },
            { label: '3072 bits', value: 3072 }
        ],
        dh: [
            { label: '2048 bits (Recommended)', value: 2048 },
            { label: '3072 bits', value: 3072 },
            { label: '4096 bits', value: 4096 }
        ],
        // All other types have fixed sizes
        ed25519: [],
        ed448: [],
        x25519: [],
        x448: [],
        'ml-dsa-44': [],
        'ml-dsa-65': [],
        'ml-dsa-87': [],
        'ml-kem-512': [],
        'ml-kem-768': [],
        'ml-kem-1024': [],
        'slh-dsa-sha2-128f': [],
        'slh-dsa-sha2-128s': [],
        'slh-dsa-sha2-192f': [],
        'slh-dsa-sha2-192s': [],
        'slh-dsa-sha2-256f': [],
        'slh-dsa-sha2-256s': [],
        'slh-dsa-shake-128f': [],
        'slh-dsa-shake-128s': [],
        'slh-dsa-shake-192f': [],
        'slh-dsa-shake-192s': [],
        'slh-dsa-shake-256f': [],
        'slh-dsa-shake-256s': []
    };

    onLazyLoad(event: any) {
        this.loading = true;

        const page = event.first / event.rows;
        const limit = event.rows;
        const sortField = event.sortField || 'name';
        const sortOrder = event.sortOrder || 1;

        const filters: any = {};
        if (event.filters) {
            Object.keys(event.filters).forEach(field => {
                const filterData = event.filters[field];
                if (filterData) {
                    if (Array.isArray(filterData)) {
                        const constraints = filterData
                            .filter(f => f && f.value !== null && f.value !== undefined && f.value !== '')
                            .map(f => ({
                                value: f.value,
                                matchMode: f.matchMode || 'contains'
                            }));
                        if (constraints.length > 0) {
                            filters[field] = {
                                operator: filterData[0]?.operator || 'and',
                                constraints
                            };
                        }
                    } else if (filterData.value !== null && filterData.value !== undefined && filterData.value !== '') {
                        filters[field] = {
                            operator: filterData.operator || 'and',
                            constraints: [{
                                value: filterData.value,
                                matchMode: filterData.matchMode || 'contains'
                            }]
                        };
                    } else if (filterData.constraints) {
                        const constraints = filterData.constraints
                            .filter((f: any) => f && f.value !== null && f.value !== undefined && f.value !== '')
                            .map((f: any) => ({
                                value: f.value,
                                matchMode: f.matchMode || 'contains'
                            }));
                        if (constraints.length > 0) {
                            filters[field] = {
                                operator: filterData.operator || 'and',
                                constraints
                            };
                        }
                    }
                }
            });
        }

        this.sshKeyService.getAllKeys(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.keys = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('sshKeys.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    showCreateDialog() {
        this.keyForm = {
            name: '',
            description: '',
            privateKey: '',
            publicKey: '',
            keyType: 'ed25519',
            keySize: undefined,
            username: 'root',
            port: 22
        };
        this.isNewKey = true;
        this.displayDialog = true;
    }

    editKey(key: SshKey) {
        this.keyForm = {
            _id: key._id,
            name: key.name,
            description: key.description || '',
            privateKey: '', // Don't load private key for edit
            publicKey: key.publicKey,
            keyType: key.keyType || 'ed25519',
            keySize: key.keySize,
            username: key.username,
            port: key.port
        };
        this.isNewKey = false;
        this.displayDialog = true;
    }

    saveKey() {
        if (!this.keyForm.name) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translateService.instant('common.warning'),
                detail: this.translateService.instant('sshKeys.errors.nameRequired')
            });
            return;
        }

        this.saving = true;

        // If creating new key and no keys present, generate them first
        if (this.isNewKey && !this.keyForm.privateKey && !this.keyForm.publicKey) {
            this.sshKeyService.generateKeyPair(this.keyForm.keyType, this.keyForm.keySize).subscribe({
                next: (result) => {
                    this.keyForm.privateKey = result.privateKey;
                    this.keyForm.publicKey = result.publicKey;
                    this.keyForm.keyType = result.keyType;
                    this.keyForm.keySize = result.keySize;
                    this.performSave();
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: this.translateService.instant('sshKeys.errors.generateFailed')
                    });
                    this.saving = false;
                }
            });
        } else {
            this.performSave();
        }
    }

    private performSave() {
        const keyData: any = {
            name: this.keyForm.name,
            description: this.keyForm.description,
            publicKey: this.keyForm.publicKey,
            keyType: this.keyForm.keyType,
            username: this.keyForm.username || 'root',
            port: this.keyForm.port || 22
        };

        if (this.keyForm.keySize !== undefined) {
            keyData.keySize = this.keyForm.keySize;
        }

        // Only include private key if provided
        if (this.keyForm.privateKey) {
            keyData.privateKey = this.keyForm.privateKey;
        }

        const request = this.isNewKey
            ? this.sshKeyService.createKey(keyData)
            : this.sshKeyService.updateKey(this.keyForm._id, keyData);

        request.subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant(this.isNewKey ? 'sshKeys.success.created' : 'sshKeys.success.updated')
                });
                this.displayDialog = false;
                this.reloadTableData()
                this.saving = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant(error.error?.message || 'sshKeys.saveFailed')
                });
                this.saving = false;
            }
        });
    }

    reloadTableData() {
        if (this.table) {
            // Get current lazy load event state from table
            const lazyLoadEvent = this.table.createLazyLoadMetadata();
            // Trigger lazy load with current state
            this.onLazyLoad(lazyLoadEvent);
        }
    }

    deleteKey(key: SshKey) {
        this.confirmationService.confirm({
            message: this.translateService.instant('sshKeys.confirmDelete', { name: key.name }),
            header: this.translateService.instant('sshKeys.confirmDelete'),
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.sshKeyService.deleteKey(key._id!).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('sshKeys.success.deleted')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: this.translateService.instant('sshKeys.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    rotateKey(key: SshKey) {
        this.confirmationService.confirm({
            message: this.translateService.instant('sshKeys.confirmRotate', { name: key.name }),
            header: this.translateService.instant('sshKeys.rotateKey'),
            icon: 'pi pi-refresh',
            accept: () => {
                this.generating = true;
                this.sshKeyService.generateKeyPair(key.keyType || 'ed25519', key.keySize).subscribe({
                    next: (result) => {
                        const keyData = {
                            privateKey: result.privateKey,
                            publicKey: result.publicKey
                        };
                        this.sshKeyService.updateKey(key._id!, keyData).subscribe({
                            next: () => {
                                this.messageService.add({
                                    severity: 'success',
                                    summary: this.translateService.instant('common.success'),
                                    detail: this.translateService.instant('sshKeys.success.rotated')
                                });
                                this.reloadTableData();
                                this.generating = false;
                            },
                            error: (error) => {
                                this.messageService.add({
                                    severity: 'error',
                                    summary: this.translateService.instant('common.error'),
                                    detail: this.translateService.instant('sshKeys.errors.rotateFailed')
                                });
                                this.generating = false;
                            }
                        });
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: this.translateService.instant('sshKeys.errors.generateFailed')
                        });
                        this.generating = false;
                    }
                });
            }
        });
    }

    copyToClipboard(text: string) {
        navigator.clipboard.writeText(text).then(() => {
            this.messageService.add({
                severity: 'success',
                summary: this.translateService.instant('common.copied'),
                detail: this.translateService.instant('sshKeys.success.copied')
            });
        }).catch(() => {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('sshKeys.errors.copyFailed')
            });
        });
    }

    getDefaultKeySize(keyType: string): number | undefined {
        switch (keyType) {
            case 'rsa':
            case 'rsa-pss':
                return 4096;
            case 'ec':
                return 256;
            case 'dsa':
            case 'dh':
                return 2048;
            // All Edwards-curve and post-quantum algorithms have fixed sizes
            default:
                return undefined;
        }
    }

    onKeyTypeChange() {
        this.keyForm.keySize = this.getDefaultKeySize(this.keyForm.keyType);
    }

}
