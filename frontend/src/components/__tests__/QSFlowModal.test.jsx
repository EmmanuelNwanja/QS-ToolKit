import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QSFlowModal from '../../components/QSFlowModal';

// Mock APIs
jest.mock('../../services/api', () => ({
  projectAPI: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    create: jest.fn().mockResolvedValue({ data: { id: 'proj1', name: 'Test Project' } }),
    update: jest.fn().mockResolvedValue({})
  },
  boqAPI: { create: jest.fn().mockResolvedValue({ data: { id: 'boq1' } }) }
}));

describe('QSFlowModal', () => {
  test('renders and navigates through steps', async () => {
    render(<QSFlowModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('QS Flow')).toBeInTheDocument();
    // Step 1 – project selection placeholder
    expect(screen.getByText(/Select a project/)).toBeInTheDocument();
    // Simulate selecting a project (no projects listed)
    fireEvent.click(screen.getByText('Select Project'));
    await waitFor(() => {
      expect(screen.getByText(/Substructure –/)).toBeInTheDocument();
    });
  });
});
