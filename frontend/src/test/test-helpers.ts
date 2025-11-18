import { NavigationExtras, Router, UrlTree } from '@angular/router';
import { EMPTY } from 'rxjs';

/**
 * Creates a jasmine Router spy object with commonly-used Router properties and methods
 * used across the app (getters + basic implementations). This prevents TypeErrors
 * when importing components that read `router.url` or call `createUrlTree`/`serializeUrl`.
 */
export function createRouterSpy(initialUrl = '/'): jasmine.SpyObj<Router> {
    const spy = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl', 'createUrlTree', 'serializeUrl']);

    // Provide url getter to avoid `undefined.includes` TypeError in components
    Object.defineProperty(spy, 'url', { get: () => initialUrl });

    // Provide events observable for RouterLink directive
    Object.defineProperty(spy, 'events', { get: () => EMPTY });

    // Standard behavior for navigate: return a resolved promise (like the real Router)
    spy.navigate.and.callFake((commands: any[], extras?: NavigationExtras) => Promise.resolve(true as any));

    // navigateByUrl usually returns a Promise<boolean>
    spy.navigateByUrl.and.callFake((url: string | UrlTree, extras?: NavigationExtras) => Promise.resolve(true as any));

    // createUrlTree returns a UrlTree; we're fine returning a simple object with toString
    spy.createUrlTree.and.callFake((commands: any[], extras?: NavigationExtras) => ({ toString: () => typeof commands === 'string' ? commands : Array.isArray(commands) ? commands.join('/') : '/' } as unknown as UrlTree));

    // serializeUrl returns a string
    spy.serializeUrl.and.callFake((urlTree: UrlTree) => (typeof (urlTree as any).toString === 'function' ? (urlTree as any).toString() : '/'));

    return spy;
}
