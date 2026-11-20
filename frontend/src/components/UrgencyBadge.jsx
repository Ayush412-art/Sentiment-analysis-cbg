import Badge from './Badge';

export default function UrgencyBadge({ value, size }) {
  if (!value) return null;
  return (
    <Badge tone={value.toLowerCase()} size={size}>
      {size === 'lg' ? value.toUpperCase() : value}
    </Badge>
  );
}
