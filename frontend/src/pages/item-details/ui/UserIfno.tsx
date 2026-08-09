import { Rate } from "antd";

export const UserInfo = ({ name, rating }: { name: string; rating: number }) => (
    <div>
        <h2>{name}</h2>
        <Rate disabled allowHalf value={rating} />
    </div>
);
