import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-last-updated',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class LastUpdatedComponent {
  date = input.required<string>();
}
