import { MissingTranslationHandlerParams } from '@ngx-translate/core';
import { ACMMissingTranslationHandler } from '../app/handlers/acmmissingexception.handler';

describe('ACMMissingTranslationHandler', () => {
    let handler: ACMMissingTranslationHandler;

    beforeEach(() => {
        handler = new ACMMissingTranslationHandler();
    });

    it('should create', () => {
        expect(handler).toBeTruthy();
    });

    it('should return formatted message for missing translation key', () => {
        const params: MissingTranslationHandlerParams = {
            key: 'test.missing.key',
            translateService: {} as any
        };

        const result = handler.handle(params);

        expect(result).toBe('[MISSING: test.missing.key]');
    });

    it('should handle simple keys', () => {
        const params: MissingTranslationHandlerParams = {
            key: 'simpleKey',
            translateService: {} as any
        };

        const result = handler.handle(params);

        expect(result).toBe('[MISSING: simpleKey]');
    });

    it('should handle nested keys with dots', () => {
        const params: MissingTranslationHandlerParams = {
            key: 'deeply.nested.translation.key',
            translateService: {} as any
        };

        const result = handler.handle(params);

        expect(result).toBe('[MISSING: deeply.nested.translation.key]');
    });

    it('should handle keys with special characters', () => {
        const params: MissingTranslationHandlerParams = {
            key: 'key-with-dashes_and_underscores',
            translateService: {} as any
        };

        const result = handler.handle(params);

        expect(result).toBe('[MISSING: key-with-dashes_and_underscores]');
    });
});
