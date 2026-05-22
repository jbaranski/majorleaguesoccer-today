import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-last-updated',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center text-muted-foreground text-2xl font-normal mt-4 mb-2">
      Last updated: {{ date() }}
    </div>
  `,
  styles: []
})
export class LastUpdatedComponent {
  date = input.required<string>();
}
