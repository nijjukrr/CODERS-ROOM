import { render, screen } from '@testing-library/react';
import App from './App';

test('renders home page components correctly', () => {
  render(<App />);
  const element = screen.getByText('Paste invitation ROOM ID');
  expect(element).toBeInTheDocument();
});
