import { Component } from '@angular/core';
import { TranslatePipe } from "@ngx-translate/core";
import { VERSION } from '../../version';

@Component({
    standalone: true,
    imports: [TranslatePipe],
    selector: 'app-footer',
    templateUrl: './app.footer.html'
})
export class AppFooter {
    version = VERSION;
    githubUrl = 'https://github.com/mlongo4290/acme-certificates-manager';
}
