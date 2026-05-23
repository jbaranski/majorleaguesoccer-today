import { Component, input } from '@angular/core';

@Component({
  selector: 'app-last-updated',
  imports: [],
  template: `
    <div class="text-center text-gray-500 text-base font-normal mt-4 mb-2">
      Last Updated: <span class="italic">{{ date() }}</span>
    </div>
  `,
  styles: []
})
export class LastUpdatedComponent {
  date = input.required<string>();
}
