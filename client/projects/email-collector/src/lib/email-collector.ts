import { Component, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EmailCollectorConfig } from './email-collector-config';

@Component({
  selector: 'ec-email-collector',
  imports: [FormsModule, CommonModule],
  templateUrl: './email-collector.html',
  styleUrl: './email-collector.css',
})
export class EmailCollector {
  config = input.required<EmailCollectorConfig>();

  email = signal('');
  isSubmitting = signal(false);
  message = signal('');
  messageType = signal<'success' | 'error' | 'info' | ''>('');

  async onSubmit() {
    const emailValue = this.email().trim();

    if (!emailValue) {
      this.showMessage('Please enter a valid email address.', 'error');
      return;
    }

    this.isSubmitting.set(true);
    this.messageType.set('');

    try {
      const response = await fetch(`${this.config().apiUrl}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailValue,
          site: this.config().site,
        }),
      });

      if (response.status === 201 || response.status == 200) {
        this.showMessage('Successfully subscribed! Thank you.', 'success');
        this.email.set('');
      } else if (response.status === 400) {
        this.showMessage('Invalid email address. Please try again.', 'error');
      } else if (response.status === 429) {
        this.showMessage('Too many requests. Please try again later.', 'error');
      } else {
        this.showMessage('Something went wrong. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      this.showMessage('Network error. Please check your connection and try again.', 'error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private showMessage(text: string, type: 'success' | 'error' | 'info') {
    this.message.set(text);
    this.messageType.set(type);
  }
}
