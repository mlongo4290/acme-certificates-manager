// CRITICAL: Polyfill MUST be first, before ANY imports that might use startViewTransition
// Stub for experimental `startViewTransition` API to prevent Chrome STATUS_BREAKPOINT crashes
(window as any).document.startViewTransition = function (callback: any) {
    if (callback) callback();
    return { ready: Promise.resolve(), finished: Promise.resolve() };
};

import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());