import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

// Polyfill/Stub for experimental `startViewTransition` API to avoid crashes during Karma tests.
// Some components or layout logic may call `document.startViewTransition` if supported by the
// browser; headless test environments or certain Chrome versions may crash on this experimental API.
// By providing a safe shim in tests, we avoid STATUS_BREAKPOINT crashes and still let code run sync.
if (typeof (document as any).startViewTransition !== 'function') {
    (document as any).startViewTransition = (callback: any) => {
        try {
            // Execute the callback synchronously so the tests behave deterministically.
            callback();
        } catch (e) {
            // ignore - test environment shouldn't crash due to this polyfill.
        }
        return { ready: Promise.resolve() };
    };
}

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());