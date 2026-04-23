import { Component } from '@angular/core';
import { EmailCollector, EmailCollectorConfig } from '@jeffs/email-collector';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-email-collector-wrapper',
  imports: [EmailCollector],
  template: `
    <div style="text-align: center; margin-bottom: 16px;">
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">Want these fixtures delivered to your inbox every morning?</p>
      <ec-email-collector [config]="emailConfig" />
    </div>
  `,
  styles: []
})
export class EmailCollectorWrapperComponent {
  emailConfig: EmailCollectorConfig = {
    apiUrl: environment.apiUrl,
    site: environment.site
  };
}
