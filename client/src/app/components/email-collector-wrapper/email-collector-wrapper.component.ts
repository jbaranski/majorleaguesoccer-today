import { Component, ChangeDetectionStrategy } from '@angular/core';
import { EmailCollector, EmailCollectorConfig } from '@jeffs/email-collector';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-email-collector-wrapper',
  imports: [EmailCollector],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center mb-4">
      <p class="text-2xl text-muted-foreground mb-4">Want these fixtures delivered to your inbox every morning?</p>
      <ec-email-collector [config]="emailConfig" />
    </div>
  `
})
export class EmailCollectorWrapperComponent {
  emailConfig: EmailCollectorConfig = {
    apiUrl: environment.apiUrl,
    site: environment.site
  };
}
