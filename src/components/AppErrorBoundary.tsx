import {Component, type ErrorInfo, type ReactNode} from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(): State {
    return {hasError: true};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed', error, info);
  }

  private retry = () => {
    this.setState({hasError: false});
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        dir="rtl"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          color: '#f7f3ea',
          background: '#111217',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <section
          style={{
            width: 'min(100%, 430px)',
            padding: '28px',
            border: '1px solid #3b3d47',
            borderRadius: '20px',
            background: '#1b1d24',
            textAlign: 'center',
          }}
        >
          <h1 style={{margin: '0 0 12px', fontSize: '24px'}}>לא הצלחנו להציג את המסך</h1>
          <p style={{margin: '0 0 22px', color: '#c9cbd3', lineHeight: 1.6}}>
            החשבון והנתונים שלך שמורים. אפשר לטעון מחדש ולהמשיך מהמקום שבו עצרת.
          </p>
          <button
            type="button"
            onClick={this.retry}
            style={{
              width: '100%',
              minHeight: '48px',
              border: 0,
              borderRadius: '12px',
              background: '#d6b467',
              color: '#171714',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            טעינה מחדש
          </button>
        </section>
      </main>
    );
  }
}
